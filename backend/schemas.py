"""
Halcyon Backend — Pydantic Schemas
Request / Response models for all API endpoints.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


# ── Analysis ──────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    log_content: str = Field(..., min_length=1, description="Raw log content to analyze")


class AIAnalysisResult(BaseModel):
    root_cause: str
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    fix_suggestion: str
    summary: str
    affected_components: List[str] = []
    confidence_score: float = Field(ge=0.0, le=1.0)


# ── File Upload ───────────────────────────────────────────────────────────────

class LogUploadResponse(BaseModel):
    filename: str
    line_count: int
    size_bytes: int
    preview: List[str]         # First 20 lines
    log_content: str           # Full content for next step


# ── Incident CRUD ─────────────────────────────────────────────────────────────

class SimilarIncidentSchema(BaseModel):
    similar_to_id: int
    similarity_score: float
    match_reason: Optional[str] = None


class IncidentBase(BaseModel):
    title: str = Field(default="Untitled Incident", max_length=255)
    log_filename: Optional[str] = None
    log_content: str
    root_cause: Optional[str] = None
    severity: Optional[str] = None
    fix_suggestion: Optional[str] = None
    summary: Optional[str] = None
    affected_components: Optional[List[str]] = None
    confidence_score: Optional[float] = None
    tags: Optional[List[str]] = []

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        valid = {"LOW", "MEDIUM", "HIGH", "CRITICAL", None}
        if v and v.upper() not in valid:
            raise ValueError(f"Severity must be one of {valid - {None}}")
        return v.upper() if v else v


class SaveIncidentRequest(IncidentBase):
    """Payload to save a complete incident (log + AI results)."""
    pass


class IncidentResponse(IncidentBase):
    id: int
    is_solved: bool
    solution: Optional[str] = None
    solved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    similar_incidents: List[SimilarIncidentSchema] = []

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    incidents: List[IncidentResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ── Mark Solved ───────────────────────────────────────────────────────────────

class MarkSolvedRequest(BaseModel):
    incident_id: int
    solution: str = Field(..., min_length=1)


# ── Update Incident ───────────────────────────────────────────────────────────

class UpdateIncidentRequest(BaseModel):
    title: Optional[str] = None
    severity: Optional[str] = None
    fix_suggestion: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        valid = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        if v and v.upper() not in valid:
            raise ValueError(f"Severity must be one of {valid}")
        return v.upper() if v else v


# ── Generic Responses ─────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class HealthResponse(BaseModel):
    status: str
    version: str
    db: str


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
