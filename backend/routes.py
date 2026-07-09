"""
Halcyon Backend — API Routes
All /api/* endpoints wired up here.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai import analyze_log
from database import Incident, IncidentTag, SimilarIncidentRef, get_db
from schemas import (
    AIAnalysisResult,
    AnalyzeRequest,
    HealthResponse,
    IncidentListResponse,
    IncidentResponse,
    LogUploadResponse,
    MarkSolvedRequest,
    MessageResponse,
    SaveIncidentRequest,
    UpdateIncidentRequest,
)
from utils import (
    find_similar_incidents,
    parse_log_content,
    sanitize_log_content,
    save_uploaded_file,
    validate_log_file,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["halcyon"])


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Liveness check — verifies API and DB are up."""
    try:
        await db.execute(select(func.count()).select_from(Incident))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return HealthResponse(status="ok", version="1.0.0", db=db_status)


# ── Log Upload ────────────────────────────────────────────────────────────────

@router.post(
    "/upload-log",
    response_model=LogUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload a log file",
    description="Accepts a .log/.txt/.out/.err file and returns a preview + full content.",
)
async def upload_log(file: UploadFile = File(...)):
    """
    Upload a log file.
    - Validates extension and size.
    - Returns preview lines, total line count, and full content.
    """
    raw_bytes = await file.read()
    size = len(raw_bytes)

    try:
        validate_log_file(file.filename or "unnamed.log", size)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        content = raw_bytes.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode file as UTF-8.")

    content = sanitize_log_content(content)
    preview, line_count = parse_log_content(content)

    # Optionally persist the file to disk
    saved_name = save_uploaded_file(raw_bytes, file.filename or "unnamed.log")

    return LogUploadResponse(
        filename=saved_name,
        line_count=line_count,
        size_bytes=size,
        preview=preview,
        log_content=content,
    )


# ── AI Analysis ───────────────────────────────────────────────────────────────

@router.post(
    "/analyze",
    response_model=AIAnalysisResult,
    status_code=status.HTTP_200_OK,
    summary="Analyze log content with AI",
)
async def analyze(body: AnalyzeRequest):
    """
    Send log content to Gemini AI for root cause analysis.
    Returns severity, root cause, fix suggestions, and affected components.
    """
    try:
        result = await analyze_log(body.log_content)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return result


# ── Save Incident ─────────────────────────────────────────────────────────────

@router.post(
    "/save-incident",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save an incident with AI analysis results",
)
async def save_incident(
    body: SaveIncidentRequest, db: AsyncSession = Depends(get_db)
):
    """
    Persist a full incident (log + AI results) to the database.
    Also runs similar-incident detection and saves references.
    """
    # 1. Find similar existing incidents
    existing_result = await db.execute(
        select(Incident).order_by(Incident.created_at.desc()).limit(100)
    )
    existing_incidents = existing_result.scalars().all()
    similar = find_similar_incidents(body.log_content, existing_incidents)

    # 2. Persist the new incident
    incident = Incident(
        title=body.title,
        log_filename=body.log_filename,
        log_content=body.log_content,
        root_cause=body.root_cause,
        severity=body.severity,
        fix_suggestion=body.fix_suggestion,
        summary=body.summary,
        affected_components=body.affected_components,
        confidence_score=body.confidence_score,
    )
    db.add(incident)
    await db.flush()  # Get the new ID

    # 3. Save tags
    for tag_name in (body.tags or []):
        db.add(IncidentTag(incident_id=incident.id, tag=tag_name.strip().lower()))

    # 4. Save similar incident references
    for sim in similar:
        db.add(
            SimilarIncidentRef(
                incident_id=incident.id,
                similar_to_id=sim["similar_to_id"],
                similarity_score=sim["similarity_score"],
                match_reason=sim["match_reason"],
            )
        )

    await db.flush()

    # Reload with relationships
    loaded = await db.execute(
        select(Incident)
        .options(selectinload(Incident.similar_refs), selectinload(Incident.tags))
        .where(Incident.id == incident.id)
    )
    saved = loaded.scalar_one()
    return _build_incident_response(saved)


# ── History / List ────────────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=IncidentListResponse,
    summary="Get all past incidents (paginated)",
)
async def get_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    severity: Optional[str] = Query(default=None),
    is_solved: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None, description="Search in title/summary"),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated list of all incidents.
    Supports filtering by severity, solved status, and free-text search.
    """
    query = select(Incident).options(
        selectinload(Incident.similar_refs),
        selectinload(Incident.tags),
    )

    if severity:
        query = query.where(Incident.severity == severity.upper())
    if is_solved is not None:
        query = query.where(Incident.is_solved == is_solved)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            Incident.title.ilike(pattern) | Incident.summary.ilike(pattern)
        )

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginated rows
    offset = (page - 1) * page_size
    query = query.order_by(Incident.created_at.desc()).offset(offset).limit(page_size)
    rows = (await db.execute(query)).scalars().all()

    return IncidentListResponse(
        incidents=[_build_incident_response(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),  # ceiling division
    )


# ── Single Incident ───────────────────────────────────────────────────────────

@router.get(
    "/incident/{incident_id}",
    response_model=IncidentResponse,
    summary="Get a single incident by ID",
)
async def get_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    incident = await _get_incident_or_404(incident_id, db)
    return _build_incident_response(incident)


# ── Update Incident ───────────────────────────────────────────────────────────

@router.patch(
    "/incident/{incident_id}",
    response_model=IncidentResponse,
    summary="Update incident fields (title, severity, tags, fix)",
)
async def update_incident(
    incident_id: int,
    body: UpdateIncidentRequest,
    db: AsyncSession = Depends(get_db),
):
    incident = await _get_incident_or_404(incident_id, db)

    if body.title is not None:
        incident.title = body.title
    if body.severity is not None:
        incident.severity = body.severity
    if body.fix_suggestion is not None:
        incident.fix_suggestion = body.fix_suggestion
    if body.tags is not None:
        await db.execute(
            delete(IncidentTag).where(IncidentTag.incident_id == incident_id)
        )
        for tag_name in body.tags:
            db.add(IncidentTag(incident_id=incident_id, tag=tag_name.strip().lower()))

    incident.updated_at = datetime.now(timezone.utc)
    await db.flush()

    reloaded = await db.execute(
        select(Incident)
        .options(selectinload(Incident.similar_refs), selectinload(Incident.tags))
        .where(Incident.id == incident_id)
    )
    return _build_incident_response(reloaded.scalar_one())


# ── Mark Solved ───────────────────────────────────────────────────────────────

@router.post(
    "/mark-solved",
    response_model=IncidentResponse,
    summary="Mark an incident as solved",
)
async def mark_solved(body: MarkSolvedRequest, db: AsyncSession = Depends(get_db)):
    """
    Mark an incident as solved and record the solution.
    """
    incident = await _get_incident_or_404(body.incident_id, db)

    if incident.is_solved:
        raise HTTPException(
            status_code=409, detail="Incident is already marked as solved."
        )

    incident.is_solved = True
    incident.solution = body.solution
    incident.solved_at = datetime.now(timezone.utc)
    incident.updated_at = datetime.now(timezone.utc)
    await db.flush()

    reloaded = await db.execute(
        select(Incident)
        .options(selectinload(Incident.similar_refs), selectinload(Incident.tags))
        .where(Incident.id == body.incident_id)
    )
    return _build_incident_response(reloaded.scalar_one())


# ── Delete Incident ───────────────────────────────────────────────────────────

@router.delete(
    "/incident/{incident_id}",
    response_model=MessageResponse,
    summary="Delete an incident permanently",
)
async def delete_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    incident = await _get_incident_or_404(incident_id, db)
    await db.delete(incident)
    return MessageResponse(message=f"Incident #{incident_id} deleted successfully.")


# ── Re-Analyze ────────────────────────────────────────────────────────────────

@router.post(
    "/incident/{incident_id}/reanalyze",
    response_model=IncidentResponse,
    summary="Re-run AI analysis on an existing incident",
)
async def reanalyze_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    """
    Re-trigger Gemini analysis for an existing incident and update results.
    """
    incident = await _get_incident_or_404(incident_id, db)

    try:
        result = await analyze_log(incident.log_content)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    incident.root_cause = result.root_cause
    incident.severity = result.severity
    incident.fix_suggestion = result.fix_suggestion
    incident.summary = result.summary
    incident.affected_components = result.affected_components
    incident.confidence_score = result.confidence_score
    incident.updated_at = datetime.now(timezone.utc)
    await db.flush()

    reloaded = await db.execute(
        select(Incident)
        .options(selectinload(Incident.similar_refs), selectinload(Incident.tags))
        .where(Incident.id == incident_id)
    )
    return _build_incident_response(reloaded.scalar_one())


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", tags=["analytics"], summary="Dashboard statistics")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Returns aggregate stats: total, solved, by-severity counts, MTTR."""
    total = (await db.execute(select(func.count()).select_from(Incident))).scalar_one()
    solved = (
        await db.execute(
            select(func.count()).select_from(Incident).where(Incident.is_solved == True)
        )
    ).scalar_one()

    severity_rows = await db.execute(
        select(Incident.severity, func.count()).group_by(Incident.severity)
    )
    by_severity = {row[0] or "UNKNOWN": row[1] for row in severity_rows}

    return {
        "total_incidents": total,
        "solved_incidents": solved,
        "open_incidents": total - solved,
        "resolution_rate": round(solved / total * 100, 1) if total else 0.0,
        "by_severity": by_severity,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_incident_or_404(incident_id: int, db: AsyncSession) -> Incident:
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.similar_refs), selectinload(Incident.tags))
        .where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(
            status_code=404, detail=f"Incident #{incident_id} not found."
        )
    return incident


def _build_incident_response(incident: Incident) -> IncidentResponse:
    from schemas import SimilarIncidentSchema

    return IncidentResponse(
        id=incident.id,
        title=incident.title,
        log_filename=incident.log_filename,
        log_content=incident.log_content,
        root_cause=incident.root_cause,
        severity=incident.severity,
        fix_suggestion=incident.fix_suggestion,
        summary=incident.summary,
        affected_components=incident.affected_components or [],
        confidence_score=incident.confidence_score,
        is_solved=incident.is_solved,
        solution=incident.solution,
        solved_at=incident.solved_at,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        tags=[t.tag for t in (incident.tags or [])],
        similar_incidents=[
            SimilarIncidentSchema(
                similar_to_id=r.similar_to_id,
                similarity_score=r.similarity_score,
                match_reason=r.match_reason,
            )
            for r in (incident.similar_refs or [])
        ],
    )
