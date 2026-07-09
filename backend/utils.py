"""
Halcyon Backend — Utility Functions
Log parsing, file validation, and similar-incident detection.
"""
import os
import re
import hashlib
import logging
from pathlib import Path
from typing import List, Tuple

from config import settings

logger = logging.getLogger(__name__)


# ── Log File Parsing ──────────────────────────────────────────────────────────

def validate_log_file(filename: str, size_bytes: int) -> None:
    """Raise ValueError if the file is not a valid log upload."""
    ext = Path(filename).suffix.lower()
    if ext not in settings.allowed_ext_set:
        raise ValueError(
            f"File extension '{ext}' is not allowed. "
            f"Allowed: {sorted(settings.allowed_ext_set)}"
        )
    if size_bytes > settings.max_upload_size_bytes:
        raise ValueError(
            f"File size {size_bytes / 1024 / 1024:.2f} MB exceeds "
            f"the {settings.max_upload_size_mb} MB limit."
        )


def parse_log_content(content: str, preview_lines: int = 20) -> Tuple[List[str], int]:
    """
    Split log content into lines.
    Returns (preview_lines_list, total_line_count).
    """
    lines = content.splitlines()
    preview = [line for line in lines[:preview_lines] if line.strip()]
    return preview, len(lines)


def sanitize_log_content(content: str) -> str:
    """
    Basic sanitization:
    - Remove null bytes
    - Normalize line endings
    - Strip trailing whitespace per line
    """
    content = content.replace("\x00", "")
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in content.split("\n")]
    return "\n".join(lines)


def save_uploaded_file(content: bytes, filename: str) -> str:
    """
    Save uploaded log bytes to the uploads directory.
    Returns the saved file path.
    """
    safe_name = re.sub(r"[^\w\-_. ]", "_", filename)
    file_hash = hashlib.md5(content).hexdigest()[:8]
    base, ext = os.path.splitext(safe_name)
    unique_name = f"{base}_{file_hash}{ext}"
    dest = os.path.join(settings.uploads_dir, unique_name)
    with open(dest, "wb") as f:
        f.write(content)
    logger.info("Saved uploaded file: %s", dest)
    return unique_name


# ── Similar Incident Detection ────────────────────────────────────────────────

# Keywords that indicate specific error categories
_ERROR_PATTERNS: dict[str, List[str]] = {
    "database": [
        "sql", "database", "db", "connection refused", "deadlock",
        "query timeout", "postgres", "mysql", "sqlite", "mongo",
    ],
    "memory": [
        "out of memory", "oom", "heap", "memory leak", "allocation failed",
        "memoryerror", "java.lang.outofmemoryerror",
    ],
    "network": [
        "timeout", "connection reset", "connection refused", "dns",
        "socket", "network", "http 5", "502", "503", "504",
    ],
    "authentication": [
        "unauthorized", "forbidden", "401", "403", "jwt", "token",
        "auth", "permission denied", "access denied",
    ],
    "disk": [
        "disk full", "no space left", "i/o error", "filesystem",
        "quota exceeded", "write failed",
    ],
    "crash": [
        "segfault", "core dump", "panic", "fatal error", "process killed",
        "oom-killer", "sigsegv", "sigkill",
    ],
}


def extract_error_fingerprints(log_content: str) -> dict[str, float]:
    """
    Return a dict of {category: score} based on keyword matches.
    Score is normalized by number of keywords matched.
    """
    content_lower = log_content.lower()
    scores: dict[str, float] = {}
    for category, keywords in _ERROR_PATTERNS.items():
        hits = sum(1 for kw in keywords if kw in content_lower)
        if hits > 0:
            scores[category] = round(hits / len(keywords), 4)
    return scores


def compute_similarity(
    fingerprint_a: dict[str, float],
    fingerprint_b: dict[str, float],
) -> float:
    """
    Cosine-style similarity between two fingerprint dicts.
    Returns a score between 0.0 and 1.0.
    """
    all_keys = set(fingerprint_a) | set(fingerprint_b)
    if not all_keys:
        return 0.0

    dot_product = sum(
        fingerprint_a.get(k, 0.0) * fingerprint_b.get(k, 0.0)
        for k in all_keys
    )
    mag_a = sum(v ** 2 for v in fingerprint_a.values()) ** 0.5
    mag_b = sum(v ** 2 for v in fingerprint_b.values()) ** 0.5

    if mag_a == 0 or mag_b == 0:
        return 0.0

    return round(dot_product / (mag_a * mag_b), 4)


def find_similar_incidents(
    new_log: str,
    existing_incidents: list,  # list[Incident ORM objects]
    threshold: float = 0.35,
    top_k: int = 5,
) -> List[dict]:
    """
    Find incidents similar to the new log.
    Returns a list of dicts with {incident_id, similarity_score, match_reason}.
    """
    new_fp = extract_error_fingerprints(new_log)
    if not new_fp:
        return []

    matches = []
    for incident in existing_incidents:
        inc_fp = extract_error_fingerprints(incident.log_content)
        score = compute_similarity(new_fp, inc_fp)
        if score >= threshold:
            # Determine shared categories for human-readable reason
            shared = [k for k in new_fp if k in inc_fp] or ["general"]
            matches.append(
                {
                    "incident_id": incident.id,
                    "similarity_score": score,
                    "match_reason": f"Shared error patterns: {', '.join(shared)}",
                    "similar_to_id": incident.id,
                }
            )

    matches.sort(key=lambda x: x["similarity_score"], reverse=True)
    return matches[:top_k]


# ── Severity Utils ────────────────────────────────────────────────────────────

SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def severity_to_level(severity: str) -> int:
    return SEVERITY_ORDER.get((severity or "LOW").upper(), 1)
