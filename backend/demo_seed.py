"""
Halcyon Backend - Demo Data Seeder

Populates the local SQLite database with curated historical incidents and
decision logs so the dashboard is not empty on first launch.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import func, select, delete

from config import settings
from data.loader import load_incidents
from database import DecisionLog, Incident, IncidentTag, SimilarIncidentRef, AsyncSessionLocal


def _parse_timestamp(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def _build_detailed_fix(src: dict) -> str:
    service = src.get("service", "the affected service")
    root_cause = src.get("root_cause", "the detected failure mode")
    resolution = src.get("resolution", "apply the known fix")
    tags = ", ".join(src.get("tags", [])) or "the active alert signature"

    return (
        f"1. Contain the issue on {service} and confirm the blast radius is limited to the current alert family.\n"
        f"2. Apply the known remediation: {resolution}.\n"
        f"3. Verify the original trigger condition no longer appears in the next 3-5 log bursts and that the service healthcheck recovers.\n"
        f"4. Add a regression guard for {tags} so this failure path is detected earlier next time.\n"
        f"5. Track the root cause hypothesis: {root_cause}."
    )


def _build_resolution_text(src: dict) -> str:
    resolution = src.get("resolution", "issue mitigated")
    minutes = src.get("resolution_time_minutes", 0)
    severity = src.get("severity", "unknown").upper()
    service = src.get("service", "service")
    return (
        f"{resolution}. Confirmed recovery on {service}, closed the alert, and backfilled the runbook "
        f"with the {severity} severity verification steps. Estimated restoration time: {minutes} minutes."
    )


def _build_decision_log(incident: Incident, src: dict, index: int) -> DecisionLog:
    severity = (src.get("severity") or "MEDIUM").upper()
    sensitive = bool(src.get("sensitive", False))
    memory_hit = index % 3 == 0
    escalated = not memory_hit and severity in {"HIGH", "CRITICAL"}

    if sensitive:
        model_used = settings.compliance_model
        model_tier = "compliance"
        cost = 0.00082
        latency_ms = 1480 + (index % 4) * 110
        escalated = True
        escalation_reason = "Sensitive content routed to compliance model for guarded analysis."
    elif memory_hit:
        model_used = settings.draft_model
        model_tier = "fast-path"
        cost = 0.00005
        latency_ms = 74 + (index % 5) * 9
        escalation_reason = "Hindsight match cleared fast-path resolution."
    elif severity in {"HIGH", "CRITICAL"}:
        model_used = settings.verifier_model
        model_tier = "verifier"
        cost = 0.00112
        latency_ms = 1840 + (index % 6) * 90
        escalation_reason = "Draft response escalated for verifier review."
    else:
        model_used = settings.draft_model
        model_tier = "drafter"
        cost = 0.00041
        latency_ms = 410 + (index % 4) * 35
        escalation_reason = "Draft model handled the incident without escalation."

    return DecisionLog(
        incident_id=incident.id,
        model_used=model_used,
        model_tier=model_tier,
        cost=cost,
        latency_ms=latency_ms,
        escalated=escalated,
        escalation_reason=escalation_reason if escalated or sensitive else None,
        memory_consulted=True,
        memory_hit=memory_hit,
        memory_match_score=0.94 if memory_hit else (0.0 if sensitive else 0.42),
        memory_match_content=(
            f"INCIDENT RESOLUTION - {src.get('alert_title', incident.title)}\n"
            f"Solution: {src.get('resolution', '')}"
        )
        if memory_hit
        else None,
        cascadeflow_used=not sensitive and not memory_hit and severity in {"HIGH", "CRITICAL"},
        decision_trace={
            "source": "demo_seed",
            "family": src.get("alert_title", incident.title),
            "service": src.get("service"),
            "model_used": model_used,
            "model_tier": model_tier,
            "memory_hit": memory_hit,
            "escalated": escalated,
            "routing_note": "Curated seed for dashboard telemetry.",
        },
        confidence_score=0.94 if memory_hit else (0.88 if severity in {"HIGH", "CRITICAL"} else 0.78),
        severity=severity,
        resolution_suggested=_build_detailed_fix(src),
        created_at=incident.created_at + timedelta(minutes=3 + (index % 4)),
    )


async def seed_demo_data() -> int:
    """Seed incidents, tags, and audit logs if the database needs richer demo data."""
    async with AsyncSessionLocal() as db:
        incidents = load_incidents()
        if not incidents:
            return 0

        existing_rows = (await db.execute(select(Incident.id, Incident.title, Incident.log_content))).all()
        existing_signatures = {
            ((row.title or "").strip().lower(), (row.log_content or "").strip())
            for row in existing_rows
        }

        # Remove the noisy demo artifact from prior uploads so the feed reads like a real incident set.
        noisy_ids = (
            await db.execute(select(Incident.id).where(func.lower(Incident.title) == "testlogs"))
        ).scalars().all()
        if noisy_ids:
            await db.execute(delete(DecisionLog).where(DecisionLog.incident_id.in_(noisy_ids)))
            await db.execute(delete(SimilarIncidentRef).where(SimilarIncidentRef.incident_id.in_(noisy_ids)))
            await db.execute(delete(IncidentTag).where(IncidentTag.incident_id.in_(noisy_ids)))
            await db.execute(delete(Incident).where(Incident.id.in_(noisy_ids)))

        created: list[tuple[Incident, dict]] = []
        family_first_ids: dict[str, int] = {}

        for index, src in enumerate(sorted(incidents, key=lambda x: _parse_timestamp(x["timestamp"]))):
            timestamp = _parse_timestamp(src["timestamp"])
            severity = (src.get("severity") or "MEDIUM").upper()
            tags = src.get("tags", [])
            affected_components = [src.get("service", "unknown"), *tags[:2]]
            signature = ((src.get("alert_title") or "").strip().lower(), "\n".join(src.get("raw_logs", [])).strip())
            if signature in existing_signatures:
                continue

            incident = Incident(
                title=src.get("alert_title", "Untitled Incident"),
                log_filename=f"{src.get('id', f'inc-{index}')}.log",
                log_content="\n".join(src.get("raw_logs", [])),
                root_cause=src.get("root_cause"),
                severity=severity,
                fix_suggestion=_build_detailed_fix(src),
                summary=_build_resolution_text(src),
                affected_components=affected_components,
                confidence_score=0.84 if severity in {"HIGH", "CRITICAL"} else 0.76,
                is_solved=index % 4 != 3,
                solution=_build_resolution_text(src) if index % 4 != 3 else None,
                solved_at=(timestamp + timedelta(minutes=src.get("resolution_time_minutes", 15)))
                if index % 4 != 3
                else None,
                created_at=timestamp,
                updated_at=timestamp + timedelta(minutes=1),
            )
            db.add(incident)
            created.append((incident, src))
            existing_signatures.add(signature)

        await db.flush()

        for incident, src in created:
            for tag in src.get("tags", []):
                db.add(IncidentTag(incident_id=incident.id, tag=tag))

            family_key = src.get("alert_title", incident.title)
            if family_key in family_first_ids:
                db.add(
                    SimilarIncidentRef(
                        incident_id=incident.id,
                        similar_to_id=family_first_ids[family_key],
                        similarity_score=0.91,
                        match_reason=f"Recurring {family_key.lower()} pattern with the same resolution playbook.",
                    )
                )
            else:
                family_first_ids[family_key] = incident.id

        for index, (incident, src) in enumerate(created):
            db.add(_build_decision_log(incident, src, index))

        await db.commit()
        return len(created)
