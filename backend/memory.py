"""
Halcyon Backend — Memory Module (Hindsight Integration)
Provides semantic memory for incident resolution using Hindsight by Vectorize.

- recall_similar(): Search memory for past incidents matching a log
- retain_resolution(): Store a resolved incident in memory for future recall
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config import settings

logger = logging.getLogger(__name__)

# ── Client Singleton ──────────────────────────────────────────────────────────

_hindsight_client = None


def _get_client():
    """Lazy-init and return the Hindsight client singleton."""
    global _hindsight_client

    if _hindsight_client is not None:
        return _hindsight_client

    if not settings.hindsight_enabled:
        logger.info("Hindsight is disabled (HINDSIGHT_ENABLED=false).")
        return None

    try:
        from hindsight_client import Hindsight

        _hindsight_client = Hindsight(base_url=settings.hindsight_url)
        logger.info(
            "✅ Hindsight client initialized → %s (bank: %s)",
            settings.hindsight_url,
            settings.hindsight_bank_id,
        )
        return _hindsight_client
    except ImportError:
        logger.warning(
            "hindsight-client not installed. Memory features disabled. "
            "Install with: pip install hindsight-client"
        )
        return None
    except Exception as exc:
        logger.warning("Failed to init Hindsight client: %s — memory disabled.", exc)
        return None


# ── Init (called from app.py lifespan) ────────────────────────────────────────

async def init_memory() -> None:
    """
    Initialize the Hindsight memory system.
    Called during FastAPI startup lifespan.
    """
    client = _get_client()
    if client is None:
        logger.info("Memory system running in DISABLED mode (no Hindsight).")
        return
        
    # Seed the database from local incidents on startup
    _seed_hindsight_from_json(client)

def _seed_hindsight_from_json(client):
    """Seed Hindsight memory with past incidents from the JSON dataset."""
    try:
        from data.loader import load_incidents
        incidents = load_incidents()
        if not incidents:
            logger.info("No incidents found in incidents.json to seed Hindsight.")
            return
            
        logger.info(f"Seeding Hindsight with {len(incidents)} incidents...")
        for inc in incidents:
            # We construct a rich document for the memory content
            content = f"INCIDENT: {inc.get('alert_title', '')}\nLOGS:\n" + "\n".join(inc.get('raw_logs', []))
            metadata = {
                "root_cause": inc.get("root_cause", ""),
                "resolution": inc.get("resolution", ""),
                "service": inc.get("service", ""),
                "tags": inc.get("tags", []),
                "sensitive": inc.get("sensitive", False)
            }
            # Add to hindsight
            client.retain(
                bank_id=settings.hindsight_bank_id,
                content=content,
                metadata=metadata
            )
        logger.info("✅ Hindsight memory seeded successfully.")
    except Exception as e:
        logger.error(f"Failed to seed Hindsight from JSON: {e}")


# ── Recall: Search Past Incidents ─────────────────────────────────────────────

def recall_similar(log_content: str) -> List[Dict[str, Any]]:
    """
    Search Hindsight memory for past incidents similar to the given log content.

    Returns a list of memory matches:
    [
        {
            "content": "...",       # The stored memory text
            "score": 0.92,          # Similarity score (0-1)
            "metadata": {...},      # Any stored metadata
        }
    ]

    Returns an empty list if Hindsight is disabled or unreachable.
    """
    client = _get_client()
    if client is None:
        return []

    # Truncate very large logs for the query (Hindsight handles indexing, but
    # we want a focused recall query — first + last 2000 chars)
    query = _build_recall_query(log_content)

    try:
        results = client.recall(
            bank_id=settings.hindsight_bank_id,
            query=query,
        )

        if not results:
            logger.info("Hindsight recall: no memories matched.")
            return []

        # Normalize response — hindsight-client returns a list of memory objects
        matches = []
        if isinstance(results, list):
            for item in results:
                match = _normalize_memory_result(item)
                if match:
                    if match.get("metadata", {}).get("type") == "code_correlation":
                        continue
                    matches.append(match)
        elif hasattr(results, "memories"):
            for item in results.memories:
                match = _normalize_memory_result(item)
                if match:
                    if match.get("metadata", {}).get("type") == "code_correlation":
                        continue
                    matches.append(match)

        # Sort by score descending
        matches.sort(key=lambda m: m.get("score", 0), reverse=True)

        logger.info(
            "Hindsight recall: %d match(es) found. Top score: %.2f",
            len(matches),
            matches[0]["score"] if matches else 0,
        )
        return matches

    except Exception as exc:
        logger.error("Hindsight recall failed: %s", exc)
        return []


# ── Retain: Store Resolved Incident ───────────────────────────────────────────

def retain_resolution(
    incident_id: int,
    title: str,
    root_cause: str,
    solution: str,
    severity: str,
    summary: str,
    affected_components: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
) -> bool:
    """
    Write a resolved incident into Hindsight memory so future similar
    incidents can be resolved faster.

    Returns True on success, False on failure.
    """
    client = _get_client()
    if client is None:
        return False

    # Build a rich memory document combining all incident context
    memory_content = _build_memory_document(
        incident_id=incident_id,
        title=title,
        root_cause=root_cause,
        solution=solution,
        severity=severity,
        summary=summary,
        affected_components=affected_components,
        tags=tags,
    )

    # Build metadata block based on user requirements
    metadata = {
        "root_cause": root_cause,
        "resolution": solution,
        "service": affected_components[0] if affected_components else "unknown",
        "tags": tags or [],
        "sensitive": False  # New incidents from the UI are marked not sensitive by default for demo
    }

    try:
        client.retain(
            bank_id=settings.hindsight_bank_id,
            content=memory_content,
            metadata=metadata
        )
        logger.info(
            "✅ Hindsight retain: stored resolution for incident #%d (%s)",
            incident_id,
            title,
        )
        return True

    except Exception as exc:
        logger.error("Hindsight retain failed for incident #%d: %s", incident_id, exc)
        return False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_recall_query(log_content: str) -> str:
    """Build a focused query string from log content for recall search."""
    max_chars = 4000
    if len(log_content) <= max_chars:
        return log_content

    half = max_chars // 2
    return (
        log_content[:half]
        + "\n\n... [truncated for recall query] ...\n\n"
        + log_content[-half:]
    )


def _build_memory_document(
    incident_id: int,
    title: str,
    root_cause: str,
    solution: str,
    severity: str,
    summary: str,
    affected_components: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
) -> str:
    """Compose a structured text document for Hindsight memory storage."""
    components = ", ".join(affected_components) if affected_components else "N/A"
    tag_str = ", ".join(tags) if tags else "N/A"
    timestamp = datetime.now(timezone.utc).isoformat()

    return (
        f"INCIDENT RESOLUTION — {title}\n"
        f"Severity: {severity}\n"
        f"Summary: {summary}\n"
        f"Root Cause: {root_cause}\n"
        f"Solution: {solution}\n"
        f"Affected Components: {components}\n"
        f"Tags: {tag_str}\n"
        f"Incident ID: {incident_id}\n"
        f"Resolved At: {timestamp}\n"
    )


def _normalize_memory_result(item: Any) -> Optional[Dict[str, Any]]:
    """Normalize a single Hindsight memory result into a standard dict."""
    try:
        # The hindsight-client may return dict or objects
        if isinstance(item, dict):
            return {
                "content": item.get("content", ""),
                "score": float(item.get("score", item.get("similarity", 0))),
                "metadata": item.get("metadata", {}),
            }
        else:
            return {
                "content": getattr(item, "content", str(item)),
                "score": float(getattr(item, "score", getattr(item, "similarity", 0))),
                "metadata": getattr(item, "metadata", {}),
            }
    except Exception as exc:
        logger.warning("Could not normalize memory result: %s", exc)
        return None


# ── Status Check ──────────────────────────────────────────────────────────────

def is_memory_available() -> bool:
    """Check if the Hindsight memory system is available and configured."""
    return _get_client() is not None


def retain_code_correlation(
    incident_id: int,
    title: str,
    root_cause: str,
    commit_sha: str,
    commit_message: str,
    plausibility: str,
    reasoning: str,
) -> bool:
    """
    Write a code correlation record into Hindsight memory.
    Connects a specific type of code change to a specific type of incident.
    """
    client = _get_client()
    if client is None:
        return False

    # Compose a structured memory document representing the correlation
    memory_content = (
        f"CODE CORRELATION RESOLUTION\n"
        f"Incident Title: {title}\n"
        f"Incident Root Cause: {root_cause}\n"
        f"Suspected Commit SHA: {commit_sha}\n"
        f"Commit Message: {commit_message}\n"
        f"Plausibility Judgment: {plausibility}\n"
        f"Correlation Reasoning: {reasoning}\n"
        f"Resolved At: {datetime.now(timezone.utc).isoformat()}\n"
    )

    metadata = {
        "type": "code_correlation",
        "incident_id": incident_id,
        "commit_sha": commit_sha,
        "commit_message": commit_message,
        "plausibility": plausibility,
        "reasoning": reasoning,
        "root_cause": root_cause,
    }

    try:
        client.retain(
            bank_id=settings.hindsight_bank_id,
            content=memory_content,
            metadata=metadata
        )
        logger.info(
            "🧠 Hindsight retain: stored code correlation for incident #%d (commit: %s)",
            incident_id,
            commit_sha[:8],
        )
        return True
    except Exception as exc:
        logger.error(
            "Hindsight retain failed for code correlation (incident #%d): %s",
            incident_id,
            exc,
        )
        return False
