"""
Halcyon Backend — API Routes
All /api/* endpoints wired up here.
Integrates: Hindsight memory, cascadeflow routing, decision audit trail.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai import analyze_log, RoutingMetadata
from config import settings
from database import DecisionLog, Incident, IncidentTag, SimilarIncidentRef, get_db
from memory import is_memory_available, recall_similar, retain_resolution
from schemas import (
    AIAnalysisResult,
    IncidentSubmitRequest,
    IncidentSubmitResponse,
    DecisionLogListResponse,
    DecisionLogSchema,
    HealthResponse,
    IncidentListResponse,
    IncidentResponse,
    LogUploadResponse,
    MarkSolvedRequest,
    MemoryInfo,
    MessageResponse,
    RoutingInfo,
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
    """Liveness check — verifies API, DB, and memory are up."""
    try:
        await db.execute(select(func.count()).select_from(Incident))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    memory_status = "ok" if is_memory_available() else "disabled"

    return HealthResponse(
        status="ok", version="1.0.0", db=db_status, memory=memory_status
    )


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


# ── AI Analysis (with Memory + cascadeflow) ──────────────────────────────────

@router.post(
    "/incidents",
    response_model=IncidentSubmitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new incident for AI analysis (memory-augmented, cost-optimized)",
)
async def create_incident(body: IncidentSubmitRequest, db: AsyncSession = Depends(get_db)):
    """
    Halcyon's core intelligence endpoint:
    1. Check Hindsight memory for similar past incidents (fast/free path)
    2. If strong match → format cached resolution instantly with cheap model
    3. If sensitive → route to compliance model bypass cascadeflow
    4. If no match → run AI analysis via cascadeflow (drafter → verifier)
    5. Save incident to DB and log decision audit trail
    """
    memory_info = MemoryInfo()
    analysis = None
    routing_meta = None

    # ── Step 1: Consult Hindsight Memory ──────────────────────────────────
    memory_matches = recall_similar(body.log_content)
    memory_info.consulted = True
    memory_info.source = "hindsight" if is_memory_available() else "disabled"

    if memory_matches:
        top_match = memory_matches[0]
        memory_info.hit = True
        memory_info.match_score = top_match.get("score", 0)
        memory_info.match_content = top_match.get("content", "")[:500]

        if memory_info.match_score >= settings.memory_match_threshold:
            logger.info("🧠 Memory hit! Score %.2f >= threshold %.2f", memory_info.match_score, settings.memory_match_threshold)
            
            # FAST PATH: use the cheap model to format the known resolution
            from ai import format_fast_path_resolution
            resolution_text = top_match.get("metadata", {}).get("resolution", "")
            if not resolution_text:
                resolution_text = "Retrieved from past incident memory: " + top_match.get("content", "")
            
            analysis, routing_meta = await format_fast_path_resolution(resolution_text)
            routing_meta.decision_trace["source"] = "hindsight_fast_path"
            routing_meta.decision_trace["match_score"] = memory_info.match_score

    # ── Step 2: Run AI Analysis (if no fast-path) ───────────────────────
    if not analysis:
        try:
            analysis, routing_meta = await analyze_log(body.log_content, sensitive=body.sensitive)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e))

    # ── Step 3: Save the Incident to DB ──────────────────────────────────
    incident = Incident(
        title=body.alert_title,
        log_content=body.log_content,
        root_cause=analysis.root_cause,
        severity=analysis.severity,
        fix_suggestion=analysis.fix_suggestion,
        summary=analysis.summary,
        affected_components=analysis.affected_components,
        confidence_score=analysis.confidence_score,
    )
    db.add(incident)
    await db.flush()

    routing = RoutingInfo(
        model_used=routing_meta.model_used,
        model_tier=routing_meta.model_tier,
        cost=routing_meta.cost,
        latency_ms=routing_meta.latency_ms,
        escalated=routing_meta.escalated,
        escalation_reason=routing_meta.escalation_reason,
        cascadeflow_used=routing_meta.cascadeflow_used,
        decision_trace=routing_meta.decision_trace,
    )

    # ── Step 4: Log the decision ─────────────────────────────────────────
    await _save_decision_log(
        db=db,
        routing_meta=routing_meta,
        memory_info=memory_info,
        analysis=analysis,
        incident_id=incident.id
    )

    return IncidentSubmitResponse(
        analysis=analysis,
        routing=routing,
        memory=memory_info,
        resolved_from_memory=routing_meta.model_tier == "fast-path",
    )


# (Removed old save-incident endpoint as it's merged into POST /incidents)


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


# ── Mark Solved (+ Hindsight retain) ──────────────────────────────────────────

@router.post(
    "/incidents/{id}/resolve",
    response_model=IncidentResponse,
    summary="Mark an incident as solved and write resolution to memory",
)
async def resolve_incident(id: int, body: MarkSolvedRequest, db: AsyncSession = Depends(get_db)):
    """
    Mark an incident as solved and record the solution.
    Also writes the resolution to Hindsight memory so Halcyon learns from it.
    """
    incident = await _get_incident_or_404(id, db)

    if incident.is_solved:
        raise HTTPException(
            status_code=409, detail="Incident is already marked as solved."
        )

    incident.is_solved = True
    incident.solution = body.solution
    incident.solved_at = datetime.now(timezone.utc)
    incident.updated_at = datetime.now(timezone.utc)
    await db.flush()

    # ── Write resolution to Hindsight memory ─────────────────────────────
    memory_stored = retain_resolution(
        incident_id=incident.id,
        title=incident.title,
        root_cause=incident.root_cause or "",
        solution=body.solution,
        severity=incident.severity or "UNKNOWN",
        summary=incident.summary or "",
        affected_components=incident.affected_components or [],
        tags=[t.tag for t in (incident.tags or [])],
    )

    if memory_stored:
        logger.info(
            "🧠 Resolution for incident #%d written to Hindsight memory.",
            incident.id,
        )
    else:
        logger.warning(
            "⚠️ Could not write resolution for incident #%d to memory.",
            incident.id,
        )

    reloaded = await db.execute(
        select(Incident)
        .options(selectinload(Incident.similar_refs), selectinload(Incident.tags))
        .where(Incident.id == id)
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
    response_model=IncidentSubmitResponse,
    summary="Re-run AI analysis on an existing incident",
)
async def reanalyze_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    """
    Re-trigger AI analysis for an existing incident and update results.
    Uses the full memory + cascadeflow pipeline.
    """
    incident = await _get_incident_or_404(incident_id, db)

    try:
        analysis, routing_meta = await analyze_log(incident.log_content)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    incident.root_cause = analysis.root_cause
    incident.severity = analysis.severity
    incident.fix_suggestion = analysis.fix_suggestion
    incident.summary = analysis.summary
    incident.affected_components = analysis.affected_components
    incident.confidence_score = analysis.confidence_score
    incident.updated_at = datetime.now(timezone.utc)
    await db.flush()

    # Log the decision
    await _save_decision_log(
        db=db,
        routing_meta=routing_meta,
        memory_info=MemoryInfo(),
        analysis=analysis,
        incident_id=incident_id,
    )

    routing = RoutingInfo(
        model_used=routing_meta.model_used,
        model_tier=routing_meta.model_tier,
        cost=routing_meta.cost,
        latency_ms=routing_meta.latency_ms,
        escalated=routing_meta.escalated,
        cascadeflow_used=routing_meta.cascadeflow_used,
        decision_trace=routing_meta.decision_trace,
    )

    return IncidentSubmitResponse(
        analysis=analysis,
        routing=routing,
        memory=MemoryInfo(),
        resolved_from_memory=False,
    )


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/dashboard/stats", tags=["analytics"], summary="Dashboard statistics")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Returns aggregate stats: total, solved, by-severity counts, cost savings."""
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

    # Decision audit stats
    total_decisions = (
        await db.execute(select(func.count()).select_from(DecisionLog))
    ).scalar_one()
    total_cost = (
        await db.execute(select(func.sum(DecisionLog.cost)))
    ).scalar_one() or 0.0
    memory_hits = (
        await db.execute(
            select(func.count()).select_from(DecisionLog).where(DecisionLog.memory_hit == True)
        )
    ).scalar_one()
    escalations = (
        await db.execute(
            select(func.count()).select_from(DecisionLog).where(DecisionLog.escalated == True)
        )
    ).scalar_one()

    return {
        "total_incidents": total,
        "solved_incidents": solved,
        "open_incidents": total - solved,
        "resolution_rate": round(solved / total * 100, 1) if total else 0.0,
        "by_severity": by_severity,
        "ai_decisions": {
            "total_decisions": total_decisions,
            "total_cost": round(total_cost, 6),
            "memory_hits": memory_hits,
            "escalations": escalations,
            "memory_hit_rate": round(memory_hits / total_decisions * 100, 1) if total_decisions else 0.0,
        },
    }


# ── Decision Audit Trail ─────────────────────────────────────────────────────

@router.get(
    "/decisions",
    response_model=DecisionLogListResponse,
    tags=["audit"],
    summary="Get decision audit trail (paginated)",
)
async def get_decisions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    incident_id: Optional[int] = Query(default=None),
    model_used: Optional[str] = Query(default=None),
    escalated: Optional[bool] = Query(default=None),
    memory_hit: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Paginated decision audit trail with filters."""
    query = select(DecisionLog)

    if incident_id is not None:
        query = query.where(DecisionLog.incident_id == incident_id)
    if model_used is not None:
        query = query.where(DecisionLog.model_used == model_used)
    if escalated is not None:
        query = query.where(DecisionLog.escalated == escalated)
    if memory_hit is not None:
        query = query.where(DecisionLog.memory_hit == memory_hit)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(DecisionLog.created_at.desc()).offset(offset).limit(page_size)
    rows = (await db.execute(query)).scalars().all()

    return DecisionLogListResponse(
        decisions=[DecisionLogSchema.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


@router.get(
    "/incidents/{incident_id}/audit",
    response_model=list[DecisionLogSchema],
    tags=["audit"],
    summary="Get decisions for a specific incident",
)
async def get_incident_decisions(
    incident_id: int, db: AsyncSession = Depends(get_db)
):
    """All decision records linked to a specific incident."""
    result = await db.execute(
        select(DecisionLog)
        .where(DecisionLog.incident_id == incident_id)
        .order_by(DecisionLog.created_at.desc())
    )
    return [DecisionLogSchema.model_validate(r) for r in result.scalars().all()]


# ── Sample Log Loader (Hackathon Demo) ────────────────────────────────────────

SAMPLE_LOGS_DIR = os.path.join(os.path.dirname(__file__), "sample_logs")


@router.get("/samples", tags=["demo"], summary="List available sample log scenarios")
async def list_samples():
    """List all available sample log files for demo purposes."""
    if not os.path.isdir(SAMPLE_LOGS_DIR):
        return {"scenarios": [], "message": "No sample_logs/ directory found."}

    scenarios = []
    for f in sorted(os.listdir(SAMPLE_LOGS_DIR)):
        if f.endswith((".log", ".txt")):
            name = os.path.splitext(f)[0]
            path = os.path.join(SAMPLE_LOGS_DIR, f)
            size = os.path.getsize(path)
            scenarios.append({"name": name, "filename": f, "size_bytes": size})

    return {"scenarios": scenarios}


@router.post(
    "/load-sample/{scenario}",
    response_model=IncidentSubmitResponse,
    tags=["demo"],
    summary="Load and analyze a sample log scenario",
)
async def load_sample(scenario: str, db: AsyncSession = Depends(get_db)):
    """
    Load a bundled sample log file and run the full Halcyon analysis pipeline.
    Useful for hackathon demos.
    """
    # Find the file
    sample_file = None
    if os.path.isdir(SAMPLE_LOGS_DIR):
        for f in os.listdir(SAMPLE_LOGS_DIR):
            if f.startswith(scenario) and f.endswith((".log", ".txt")):
                sample_file = os.path.join(SAMPLE_LOGS_DIR, f)
                break

    if not sample_file or not os.path.exists(sample_file):
        raise HTTPException(
            status_code=404,
            detail=f"Sample scenario '{scenario}' not found. Use GET /api/samples to list available scenarios.",
        )

    with open(sample_file, "r", encoding="utf-8", errors="replace") as fh:
        log_content = fh.read()

    # Run through the same analysis pipeline
    body = IncidentSubmitRequest(alert_title=scenario, log_content=log_content)
    return await create_incident(body, db)


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


def _parse_memory_to_analysis(memory_match: dict) -> AIAnalysisResult:
    """Parse a Hindsight memory match into an AIAnalysisResult."""
    content = memory_match.get("content", "")

    # Try to parse structured fields from the stored memory document
    lines = content.split("\n")
    fields = {}
    for line in lines:
        if ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip().lower()] = value.strip()

    return AIAnalysisResult(
        root_cause=fields.get("root cause", "Retrieved from past incident memory."),
        severity=fields.get("severity", "MEDIUM"),
        fix_suggestion=fields.get("solution", fields.get("fix suggestion", "See past resolution.")),
        summary=fields.get("summary", "Resolved from Hindsight memory — similar past incident found."),
        affected_components=(
            [c.strip() for c in fields.get("affected components", "").split(",") if c.strip()]
            or ["unknown"]
        ),
        confidence_score=min(1.0, memory_match.get("score", 0.8)),
    )


async def _save_decision_log(
    db: AsyncSession,
    routing_meta: RoutingMetadata,
    memory_info: MemoryInfo,
    analysis: AIAnalysisResult,
    incident_id: Optional[int] = None,
) -> None:
    """Persist a decision audit record."""
    try:
        log = DecisionLog(
            incident_id=incident_id,
            model_used=routing_meta.model_used,
            model_tier=routing_meta.model_tier,
            cost=routing_meta.cost,
            latency_ms=routing_meta.latency_ms,
            escalated=routing_meta.escalated,
            escalation_reason=routing_meta.escalation_reason or None,
            memory_consulted=memory_info.consulted,
            memory_hit=memory_info.hit,
            memory_match_score=memory_info.match_score if memory_info.hit else None,
            memory_match_content=memory_info.match_content[:500] if memory_info.hit else None,
            cascadeflow_used=routing_meta.cascadeflow_used,
            decision_trace=routing_meta.decision_trace,
            confidence_score=analysis.confidence_score,
            severity=analysis.severity,
            resolution_suggested=analysis.fix_suggestion,
        )
        db.add(log)
        await db.flush()
        logger.debug("Decision log saved (model=%s, cost=$%.6f)", routing_meta.model_used, routing_meta.cost)
    except Exception as exc:
        logger.error("Failed to save decision log: %s", exc)
