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
                    matches.append(match)
        elif hasattr(results, "memories"):
            for item in results.memories:
                match = _normalize_memory_result(item)
                if match:
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

    try:
        client.retain(
            bank_id=settings.hindsight_bank_id,
            content=memory_content,
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
