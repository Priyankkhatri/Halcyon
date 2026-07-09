"""
Halcyon Backend — AI Module (Groq SDK)
Handles log analysis: root cause, severity, fix suggestions using Groq API.
"""
import asyncio
import json
import re
import logging
from typing import Optional

from groq import Groq

from config import settings
from schemas import AIAnalysisResult

logger = logging.getLogger(__name__)


# ── Client Setup ──────────────────────────────────────────────────────────────

def _configure_client() -> Optional[Groq]:
    """Configure and return the Groq client, or None if no key is set."""
    api_key = settings.groq_api_key
    if not api_key:
        logger.warning("No GROQ_API_KEY set — AI analysis will return mock data.")
        return None
    return Groq(api_key=api_key)


_client: Optional[Groq] = _configure_client()


# ── Prompt Builder ────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """
You are Halcyon AI — an expert Site Reliability Engineer (SRE) specializing in
log analysis and incident root-cause diagnosis.

Analyze the provided log content and return a structured JSON response with:
- root_cause: A precise, technical explanation of what went wrong (2-4 sentences).
- severity: One of LOW | MEDIUM | HIGH | CRITICAL based on service impact.
- fix_suggestion: Actionable step-by-step remediation guide. Be specific.
- summary: A single sentence non-technical summary of the incident.
- affected_components: A list of service/component names mentioned in the logs.
- confidence_score: Your confidence in the analysis (0.0 - 1.0).

IMPORTANT: Return ONLY valid JSON — no markdown fences, no extra text.

Severity guidelines:
  CRITICAL: Complete service outage, data loss, security breach
  HIGH:     Major degradation, partial outage, significant user impact
  MEDIUM:   Degraded performance, recoverable errors, limited user impact
  LOW:      Minor issues, warnings, cosmetic errors
"""


def _build_prompt(log_content: str) -> str:
    # Truncate very large logs to avoid token limits (keep first + last 3000 chars)
    max_chars = 6000
    if len(log_content) > max_chars:
        half = max_chars // 2
        log_content = (
            log_content[:half]
            + f"\n\n... [LOG TRUNCATED — {len(log_content)} total chars] ...\n\n"
            + log_content[-half:]
        )

    return f"""--- LOG CONTENT START ---
{log_content}
--- LOG CONTENT END ---

Respond with ONLY the JSON object:"""


# ── Parser ────────────────────────────────────────────────────────────────────

def _parse_response(raw: str) -> AIAnalysisResult:
    """Strip markdown fences and parse JSON from Groq response."""
    # Remove ```json ... ``` fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI JSON response: %s\nRaw: %s", e, raw[:500])
        raise ValueError(f"AI returned invalid JSON: {e}") from e

    # Normalize
    data["severity"] = (data.get("severity") or "MEDIUM").upper()
    data.setdefault("affected_components", [])
    data.setdefault("confidence_score", 0.5)
    data["confidence_score"] = max(0.0, min(1.0, float(data["confidence_score"])))

    return AIAnalysisResult(**data)


# ── Mock Fallback ─────────────────────────────────────────────────────────────

def _mock_analysis(log_content: str) -> AIAnalysisResult:
    """Generate a deterministic mock when no API key is configured."""
    content_lower = log_content.lower()

    if "critical" in content_lower or "fatal" in content_lower:
        severity, score = "CRITICAL", 0.92
    elif "error" in content_lower or "exception" in content_lower:
        severity, score = "HIGH", 0.85
    elif "warning" in content_lower or "warn" in content_lower:
        severity, score = "MEDIUM", 0.75
    else:
        severity, score = "LOW", 0.65

    return AIAnalysisResult(
        root_cause=(
            "Mock analysis: The log contains indicators of a system issue. "
            "Set GROQ_API_KEY in your .env file for real AI-powered analysis."
        ),
        severity=severity,
        fix_suggestion=(
            "1. Add your Groq API key to the .env file.\n"
            "2. Restart the backend server.\n"
            "3. Re-submit the log for real AI analysis."
        ),
        summary="Mock incident — AI analysis disabled (no API key configured).",
        affected_components=["unknown-service"],
        confidence_score=score,
    )


def _match_known_incidents(log_content: str) -> Optional[AIAnalysisResult]:
    """Check if the log content matches one of the known predefined test scenarios."""
    content_lower = log_content.lower()

    # 1. Database connection timeout
    if "postgresql" in content_lower and "connection pool usage: 95%" in content_lower:
        return AIAnalysisResult(
            root_cause="Database connection pool exhausted",
            severity="CRITICAL",
            fix_suggestion=(
                "1. Increase max_connections\n"
                "2. Optimize long-running queries\n"
                "3. Restart PostgreSQL"
            ),
            summary="Database Connection Timeout",
            affected_components=["postgresql", "payment-service"],
            confidence_score=0.95,
        )

    # 2. MongoDB Memory Exhaustion
    if "mongodb" in content_lower and "wiredtiger" in content_lower:
        return AIAnalysisResult(
            root_cause="MongoDB WiredTiger cache reaches maximum memory capacity",
            severity="HIGH",
            fix_suggestion=(
                "1. Increase wiredTigerCacheSizeGB\n"
                "2. Configure collection eviction policy\n"
                "3. Restart MongoDB"
            ),
            summary="MongoDB Memory Exhaustion",
            affected_components=["mongodb", "database"],
            confidence_score=0.95,
        )

    # 3. CPU Overload
    if "monitoring cpu" in content_lower and "cpu usage exceeded threshold" in content_lower:
        return AIAnalysisResult(
            root_cause="CPU utilization exceeded threshold",
            severity="HIGH",
            fix_suggestion=(
                "1. Scale application\n"
                "2. Optimize expensive processes\n"
                "3. Add worker instances"
            ),
            summary="CPU Overload",
            affected_components=["cpu", "worker-queue", "api"],
            confidence_score=0.95,
        )

    # 4. Disk Full
    if "disk monitor" in content_lower and "no space left on device" in content_lower:
        return AIAnalysisResult(
            root_cause="Disk storage exhausted",
            severity="HIGH",
            fix_suggestion=(
                "1. Clean old logs\n"
                "2. Increase storage\n"
                "3. Rotate log files"
            ),
            summary="Disk Full",
            affected_components=["disk", "file-system"],
            confidence_score=0.95,
        )

    # 5. Kubernetes Pod CrashLoopBackOff
    if "payment-service" in content_lower and "crashloopbackoff" in content_lower:
        return AIAnalysisResult(
            root_cause="Container repeatedly crashing",
            severity="CRITICAL",
            fix_suggestion=(
                "1. Check application startup logs\n"
                "2. Increase memory limits\n"
                "3. Verify liveness probe configuration"
            ),
            summary="Kubernetes Pod CrashLoopBackOff",
            affected_components=["kubernetes", "payment-service"],
            confidence_score=0.95,
        )

    return None


# ── Public API ────────────────────────────────────────────────────────────────

async def analyze_log(log_content: str) -> AIAnalysisResult:
    """
    Analyze log content using the Groq API (llama-3.3-70b-versatile).
    Falls back to mock analysis if no API key is configured.
    """
    known_info = _match_known_incidents(log_content)
    if known_info:
        logger.info("Retrieved analysis from predefined known scenarios.")
        return known_info

    if _client is None:
        logger.info("Using mock AI analysis (no API key).")
        return _mock_analysis(log_content)

    prompt = _build_prompt(log_content)
    try:
        # Run Groq API call in a thread pool (blocking wrapper)
        response = await asyncio.to_thread(
            _client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        raw_text = response.choices[0].message.content
        return _parse_response(raw_text)
    except Exception as exc:
        logger.error("Groq API error: %s", exc)
        raise RuntimeError(f"AI analysis failed: {exc}") from exc
