"""
Halcyon Backend — Database Models & Async Engine
Uses SQLAlchemy 2.x with aiosqlite for non-blocking SQLite.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean,
    DateTime, JSON, ForeignKey, Index
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from config import settings


# ── Engine & Session ──────────────────────────────────────────────────────────

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── ORM Base ──────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Models ────────────────────────────────────────────────────────────────────

class Incident(Base):
    """
    Core incident record. Stores the uploaded log content,
    AI-generated analysis, and resolution metadata.
    """
    __tablename__ = "incidents"

    id: int = Column(Integer, primary_key=True, index=True)
    title: str = Column(String(255), nullable=False, default="Untitled Incident")
    log_filename: Optional[str] = Column(String(255), nullable=True)
    log_content: str = Column(Text, nullable=False)

    # AI Analysis results
    root_cause: Optional[str] = Column(Text, nullable=True)
    severity: Optional[str] = Column(String(20), nullable=True)   # LOW / MEDIUM / HIGH / CRITICAL
    fix_suggestion: Optional[str] = Column(Text, nullable=True)
    summary: Optional[str] = Column(Text, nullable=True)
    affected_components: Optional[str] = Column(JSON, nullable=True)  # list[str]
    confidence_score: Optional[float] = Column(Float, nullable=True)   # 0.0 – 1.0

    # Status & resolution
    is_solved: bool = Column(Boolean, default=False, nullable=False)
    solution: Optional[str] = Column(Text, nullable=True)
    solved_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    similar_refs = relationship(
        "SimilarIncidentRef",
        back_populates="incident",
        cascade="all, delete-orphan",
    )
    tags = relationship(
        "IncidentTag",
        back_populates="incident",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_incidents_severity", "severity"),
        Index("ix_incidents_is_solved", "is_solved"),
        Index("ix_incidents_created_at", "created_at"),
    )


class SimilarIncidentRef(Base):
    """
    Stores references from one incident to similar past incidents,
    along with the similarity score.
    """
    __tablename__ = "similar_incident_refs"

    id: int = Column(Integer, primary_key=True, index=True)
    incident_id: int = Column(
        Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    similar_to_id: int = Column(Integer, nullable=False)   # id of the similar incident
    similarity_score: float = Column(Float, default=0.0)
    match_reason: Optional[str] = Column(Text, nullable=True)

    incident = relationship("Incident", back_populates="similar_refs")


class IncidentTag(Base):
    """
    Free-form tags associated with an incident (e.g. 'database', 'auth', 'timeout').
    """
    __tablename__ = "incident_tags"

    id: int = Column(Integer, primary_key=True, index=True)
    incident_id: int = Column(
        Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    tag: str = Column(String(50), nullable=False)

    incident = relationship("Incident", back_populates="tags")

    __table_args__ = (
        Index("ix_incident_tags_tag", "tag"),
    )


class DecisionLog(Base):
    """
    Audit trail for every AI analysis decision.
    Records which model was used, why, cost, latency, and whether
    memory (Hindsight) was consulted.
    """
    __tablename__ = "decision_logs"

    id: int = Column(Integer, primary_key=True, index=True)
    incident_id: Optional[int] = Column(
        Integer, ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True
    )

    # Model routing
    model_used: str = Column(String(100), nullable=False, default="unknown")
    model_tier: str = Column(String(20), nullable=False, default="direct")  # drafter|verifier|direct|mock|known
    cost: float = Column(Float, default=0.0)
    latency_ms: float = Column(Float, default=0.0)

    # Escalation
    escalated: bool = Column(Boolean, default=False)
    escalation_reason: Optional[str] = Column(Text, nullable=True)

    # Memory (Hindsight)
    memory_consulted: bool = Column(Boolean, default=False)
    memory_hit: bool = Column(Boolean, default=False)
    memory_match_score: Optional[float] = Column(Float, nullable=True)
    memory_match_content: Optional[str] = Column(Text, nullable=True)

    # cascadeflow
    cascadeflow_used: bool = Column(Boolean, default=False)
    decision_trace: Optional[str] = Column(JSON, nullable=True)  # Full routing trace

    # Analysis result snapshot
    confidence_score: Optional[float] = Column(Float, nullable=True)
    severity: Optional[str] = Column(String(20), nullable=True)

    # Timestamp
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship
    incident = relationship("Incident", backref="decision_logs")

    __table_args__ = (
        Index("ix_decision_logs_incident_id", "incident_id"),
        Index("ix_decision_logs_created_at", "created_at"),
        Index("ix_decision_logs_model_used", "model_used"),
    )


# ── Dependency ────────────────────────────────────────────────────────────────

async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Init ──────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """Create all tables on startup (idempotent)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
