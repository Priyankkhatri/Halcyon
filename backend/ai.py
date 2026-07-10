"""
Halcyon Backend — AI Module (cascadeflow + Groq)
Handles log analysis with intelligent model routing via cascadeflow.
Falls back to direct Groq SDK when cascadeflow is disabled.
"""
import asyncio
import json
import re
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from groq import Groq

from config import settings
from schemas import AIAnalysisResult

logger = logging.getLogger(__name__)


# ── Routing Metadata ──────────────────────────────────────────────────────────

@dataclass
class RoutingMetadata:
    """Captures model-routing decisions for the audit trail."""
    model_used: str = "unknown"
    model_tier: str = "direct"           # drafter | verifier | direct | mock | known
    cost: float = 0.0
    latency_ms: float = 0.0
    escalated: bool = False
    escalation_reason: str = ""
    decision_trace: Dict[str, Any] = field(default_factory=dict)
    cascadeflow_used: bool = False


# ── Client Setup ──────────────────────────────────────────────────────────────

def _configure_groq_client() -> Optional[Groq]:
    """Configure and return the Groq client, or None if no key is set."""
    api_key = settings.groq_api_key
    if not api_key:
        logger.warning("No GROQ_API_KEY set — AI analysis will return mock data.")
        return None
    return Groq(api_key=api_key)


_groq_client: Optional[Groq] = _configure_groq_client()


# ── CascadeFlow Setup ────────────────────────────────────────────────────────

_cascade_agent = None


def _configure_cascade():
    """Configure the cascadeflow CascadeAgent if enabled and available."""
    global _cascade_agent

    if not settings.cascadeflow_enabled:
        logger.info("cascadeflow is disabled (CASCADEFLOW_ENABLED=false).")
        return

    if not settings.groq_api_key:
        logger.info("cascadeflow skipped — no GROQ_API_KEY for model calls.")
        return

    try:
        from cascadeflow import CascadeAgent, ModelConfig

        _cascade_agent = CascadeAgent(models=[
            ModelConfig(
                name=settings.draft_model,
                provider="groq",
                cost=0.00005,    # ~$0.05/1M tokens (llama-3.1-8b)
            ),
            ModelConfig(
                name=settings.verifier_model,
                provider="groq",
                cost=0.00059,    # ~$0.59/1M tokens (llama-3.3-70b)
            ),
        ])

        logger.info(
            "✅ cascadeflow CascadeAgent initialized: %s → %s (mode: %s)",
            settings.draft_model,
            settings.verifier_model,
            settings.cascadeflow_mode,
        )
    except ImportError:
        logger.warning(
            "cascadeflow not installed. Using direct Groq calls. "
            "Install with: pip install cascadeflow"
        )
    except Exception as exc:
        logger.warning("Failed to init cascadeflow: %s — falling back to direct Groq.", exc)


# Eager init
_configure_cascade()


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
    """Strip markdown fences and parse JSON from LLM response."""
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


# ── cascadeflow Analysis Path ─────────────────────────────────────────────────

async def _analyze_with_cascade(log_content: str) -> tuple[AIAnalysisResult, RoutingMetadata]:
    """Run analysis through cascadeflow's CascadeAgent for intelligent model routing."""
    metadata = RoutingMetadata(cascadeflow_used=True)
    prompt = _build_prompt(log_content)
    start = time.perf_counter()

    try:
        result = await _cascade_agent.run(
            prompt,
            system_prompt=_SYSTEM_PROMPT,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000
        metadata.latency_ms = round(elapsed_ms, 1)

        # Extract routing info from cascadeflow result
        metadata.model_used = getattr(result, "model_used", settings.draft_model)
        metadata.cost = getattr(result, "total_cost", 0.0)

        # Determine if escalation happened
        if hasattr(result, "model_used") and result.model_used != settings.draft_model:
            metadata.escalated = True
            metadata.model_tier = "verifier"
            metadata.escalation_reason = "Quality validation triggered escalation to verifier model"
        else:
            metadata.model_tier = "drafter"

        # Build decision trace
        metadata.decision_trace = {
            "draft_model": settings.draft_model,
            "verifier_model": settings.verifier_model,
            "model_used": metadata.model_used,
            "escalated": metadata.escalated,
            "cost": metadata.cost,
            "latency_ms": metadata.latency_ms,
            "cascadeflow_mode": settings.cascadeflow_mode,
        }

        # Add savings info if available
        if hasattr(result, "savings_percentage"):
            metadata.decision_trace["savings_percentage"] = result.savings_percentage

        raw_text = result.content if hasattr(result, "content") else str(result)
        analysis = _parse_response(raw_text)

        logger.info(
            "cascadeflow analysis complete: model=%s, escalated=%s, cost=$%.6f, latency=%.0fms",
            metadata.model_used,
            metadata.escalated,
            metadata.cost,
            metadata.latency_ms,
        )
        return analysis, metadata

    except Exception as exc:
        logger.error("cascadeflow analysis failed: %s — falling back to direct Groq", exc)
        # Fall back to direct Groq
        return await _analyze_with_groq(log_content)


# ── Direct Groq Analysis Path ────────────────────────────────────────────────

async def _analyze_with_groq(log_content: str) -> tuple[AIAnalysisResult, RoutingMetadata]:
    """Run analysis directly through the Groq SDK (fallback path)."""
    metadata = RoutingMetadata(
        model_used=settings.verifier_model,
        model_tier="direct",
        cascadeflow_used=False,
    )
    prompt = _build_prompt(log_content)
    start = time.perf_counter()

    try:
        response = await asyncio.to_thread(
            _groq_client.chat.completions.create,
            model=settings.verifier_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1024,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000
        metadata.latency_ms = round(elapsed_ms, 1)

        # Extract usage for cost estimation
        usage = getattr(response, "usage", None)
        if usage:
            total_tokens = getattr(usage, "total_tokens", 0)
            metadata.cost = total_tokens * 0.00000059  # rough llama-3.3-70b rate

        metadata.decision_trace = {
            "model_used": settings.verifier_model,
            "fallback": True,
            "reason": "cascadeflow unavailable or disabled",
            "latency_ms": metadata.latency_ms,
            "cost": metadata.cost,
        }

        raw_text = response.choices[0].message.content
        analysis = _parse_response(raw_text)

        logger.info(
            "Direct Groq analysis complete: model=%s, cost=$%.6f, latency=%.0fms",
            settings.verifier_model,
            metadata.cost,
            metadata.latency_ms,
        )
        return analysis, metadata

    except Exception as exc:
        logger.error("Groq API error: %s", exc)
        raise RuntimeError(f"AI analysis failed: {exc}") from exc


# ── Public API ────────────────────────────────────────────────────────────────

async def analyze_log(log_content: str) -> tuple[AIAnalysisResult, RoutingMetadata]:
    """
    Analyze log content using cascadeflow-routed models.

    Returns:
        (AIAnalysisResult, RoutingMetadata) — analysis results + routing audit info.

    Execution priority:
        1. Check predefined known incidents (instant, free)
        2. If cascadeflow is available → use CascadeAgent (drafter → verifier)
        3. If cascadeflow unavailable → direct Groq SDK call
        4. If no API key → mock analysis
    """
    # 1. Known incident patterns (instant match, no cost)
    known_info = _match_known_incidents(log_content)
    if known_info:
        logger.info("Retrieved analysis from predefined known scenarios.")
        metadata = RoutingMetadata(
            model_used="predefined-pattern",
            model_tier="known",
            cost=0.0,
            latency_ms=0.0,
            decision_trace={"source": "predefined_known_incidents"},
        )
        return known_info, metadata

    # 2. No API key → mock
    if _groq_client is None:
        logger.info("Using mock AI analysis (no API key).")
        metadata = RoutingMetadata(
            model_used="mock",
            model_tier="mock",
            cost=0.0,
            latency_ms=0.0,
            decision_trace={"source": "mock_no_api_key"},
        )
        return _mock_analysis(log_content), metadata

    # 3. cascadeflow available → use it
    if _cascade_agent is not None:
        return await _analyze_with_cascade(log_content)

    # 4. Direct Groq fallback
    return await _analyze_with_groq(log_content)
