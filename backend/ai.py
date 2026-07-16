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
    """Configure and return the Groq client, or None if no key is set or is a placeholder."""
    api_key = settings.groq_api_key
    if not api_key or api_key == "your_groq_api_key_here":
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

    if not settings.groq_api_key or settings.groq_api_key == "your_groq_api_key_here":
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
You are Halcyon AI — an expert Site Reliability Engineer (SRE).
Your task is to analyze the provided log content and return a JSON object explaining the crash.

Return ONLY a raw JSON object. NO markdown formatting. NO backticks. NO ```json. NO extra text.
The JSON must have the following keys exactly:
{
  "root_cause": "A precise, technical explanation of what went wrong (2-4 sentences). Mention the exact typo or code issue if visible.",
  "severity": "CRITICAL, HIGH, MEDIUM, or LOW",
  "fix_suggestion": "Actionable step-by-step remediation guide. Explain exactly what code to change to fix the typo or error.",
  "summary": "A single sentence non-technical summary of the incident.",
  "affected_components": ["component1", "component2"],
  "confidence_score": 0.95
}

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
    for field_name in ["root_cause", "summary", "fix_suggestion"]:
        val = data.get(field_name)
        if isinstance(val, list):
            data[field_name] = "\n".join(str(item) for item in val)
        elif isinstance(val, dict):
            data[field_name] = "\n".join(f"{k.capitalize()}: {v}" for k, v in val.items())
        elif val is not None and not isinstance(val, str):
            data[field_name] = str(val)

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
            "Set GROQ_API_KEY in your .env file for real AI-powered analysis and richer remediation guidance."
        ),
        severity=severity,
        fix_suggestion=(
            "1. Confirm the failing service and isolate the blast radius.\n"
            "2. Apply the known remediation or rollback the last risky change.\n"
            "3. Validate healthchecks, error rate, and latency after the change.\n"
            "4. Add a guardrail so the same signature is caught earlier next time.\n"
            "5. Add your Groq API key to the .env file and re-submit the log for deeper analysis."
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
                "1. Freeze new traffic if the queue is backing up and confirm which app nodes are saturating the pool.\n"
                "2. Increase max_connections and the application-side pool limit in tandem.\n"
                "3. Restart PostgreSQL only after the config change is in place.\n"
                "4. Re-run the top slow queries and verify the timeout curve normalizes.\n"
                "5. Add query-level observability so this cannot silently recur."
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
                "1. Confirm the working set size and identify the collection causing cache churn.\n"
                "2. Increase wiredTigerCacheSizeGB within node memory limits.\n"
                "3. Tune eviction and index access patterns for the hottest collection.\n"
                "4. Restart MongoDB during a controlled window and verify cache residency after recovery."
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
                "1. Check whether the spike is caused by a single hot endpoint or a broad traffic surge.\n"
                "2. Scale the affected service vertically or horizontally while the queue is draining.\n"
                "3. Profile the expensive code path and remove the tight loop or repeated serialization.\n"
                "4. Add worker instances or autoscaling once the hot path is confirmed stable."
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
                "1. Move the service into maintenance mode if writes are still failing.\n"
                "2. Clean old logs and temporary artifacts immediately.\n"
                "3. Increase storage or expand the attached volume before re-enabling writes.\n"
                "4. Rotate logs and add a retention policy so the disk does not fill again."
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
                "1. Inspect the startup logs and identify the exact line that fails before readiness.\n"
                "2. Increase memory or CPU limits if the process is dying from resource pressure.\n"
                "3. Temporarily disable the liveness probe until the service passes startup consistently.\n"
                "4. Redeploy only after the crash signature is removed and the pod stays ready."
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

async def _analyze_with_groq(
    log_content: str, 
    model: str = None, 
    model_tier: str = "direct"
) -> tuple[AIAnalysisResult, RoutingMetadata]:
    """Run analysis directly through the Groq SDK (fallback path or specific model)."""
    model_name = model or settings.verifier_model
    metadata = RoutingMetadata(
        model_used=model_name,
        model_tier=model_tier,
        cascadeflow_used=False,
    )
    prompt = _build_prompt(log_content)
    start = time.perf_counter()

    try:
        response = await asyncio.to_thread(
            _groq_client.chat.completions.create,
            model=model_name,
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
            "model_used": model_name,
            "fallback": model_tier == "direct",
            "reason": "Direct Groq call",
            "latency_ms": metadata.latency_ms,
            "cost": metadata.cost,
        }

        raw_text = response.choices[0].message.content
        analysis = _parse_response(raw_text)

        logger.info(
            "Direct Groq analysis complete: model=%s, cost=$%.6f, latency=%.0fms",
            model_name,
            metadata.cost,
            metadata.latency_ms,
        )
        return analysis, metadata

    except Exception as exc:
        logger.error("Groq API error: %s", exc)
        raise RuntimeError(f"AI analysis failed: {exc}") from exc


# ── Local Ollama Analysis Path ───────────────────────────────────────────────

async def _analyze_with_ollama(log_content: str) -> tuple[AIAnalysisResult, RoutingMetadata]:
    """Run analysis locally through Ollama's OpenAI-compatible endpoint."""
    model_name = settings.ollama_model
    metadata = RoutingMetadata(
        model_used=model_name,
        model_tier="local-ollama",
        cascadeflow_used=False,
    )
    prompt = _build_prompt(log_content)
    start = time.perf_counter()

    import httpx
    headers = {
        "ngrok-skip-browser-warning": "true"
    }
    if settings.ollama_token:
        headers["Authorization"] = f"Bearer {settings.ollama_token}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.ollama_url}/v1/chat/completions",
                json={
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 1024,
                },
                headers=headers,
                timeout=60.0,
            )
            response.raise_for_status()
            res_data = response.json()

        elapsed_ms = (time.perf_counter() - start) * 1000
        metadata.latency_ms = round(elapsed_ms, 1)

        # Extract usage for local cost estimation (zero cost, but track tokens)
        usage = res_data.get("usage", {}) or {}
        total_tokens = usage.get("total_tokens", 0)
        metadata.cost = 0.0  # local run is free!

        metadata.decision_trace = {
            "model_used": model_name,
            "provider": "ollama",
            "latency_ms": metadata.latency_ms,
            "cost": 0.0,
            "total_tokens": total_tokens,
        }

        raw_text = res_data["choices"][0]["message"]["content"]
        analysis = _parse_response(raw_text)

        logger.info(
            "Local Ollama analysis complete: model=%s, latency=%.0fms",
            model_name,
            metadata.latency_ms,
        )
        return analysis, metadata

    except Exception as exc:
        logger.error("Local Ollama API error: %s", exc)
        raise RuntimeError(f"Local Ollama analysis failed: {exc}") from exc


# ── Compliance & Fast-Path ──────────────────────────────────────────────────

async def _analyze_with_compliance_model(log_content: str) -> tuple[AIAnalysisResult, RoutingMetadata]:
    """Force routing to the local/compliance model for sensitive data."""
    logger.warning("Sensitive data detected. Routing to COMPLIANCE_MODEL.")
    return await _analyze_with_groq(
        log_content, 
        model=settings.compliance_model, 
        model_tier="compliance"
    )

async def format_fast_path_resolution(memory_resolution: str) -> tuple[AIAnalysisResult, RoutingMetadata]:
    """Format a known Hindsight memory resolution into structured JSON using the cheap model."""
    logger.info("Fast path triggered: formatting memory resolution with cheap model.")
    if _groq_client is None:
        metadata = RoutingMetadata(
            model_used="mock",
            model_tier="fast-path",
            cost=0.0,
            latency_ms=0.0,
            decision_trace={"source": "mock_fast_path_no_api_key"},
        )
        return _mock_analysis(memory_resolution), metadata

    prompt = f"Format the following incident resolution into the required JSON schema:\n\n{memory_resolution}"
    return await _analyze_with_groq(
        prompt, 
        model=settings.draft_model, 
        model_tier="fast-path"
    )

# ── Public API ────────────────────────────────────────────────────────────────

async def analyze_log(log_content: str, sensitive: bool = False) -> tuple[AIAnalysisResult, RoutingMetadata]:
    """
    Analyze log content using cascadeflow-routed models.

    Returns:
        (AIAnalysisResult, RoutingMetadata) — analysis results + routing audit info.

    Execution priority:
        1. Check sensitive flag -> route to local/compliance model.
        2. Check predefined known incidents (instant, free)
        3. If cascadeflow is available → use CascadeAgent (drafter → verifier)
        4. If cascadeflow unavailable → direct Groq SDK call
        5. If no API key → mock analysis
    """
    # 0. Compliance Gate
    if sensitive:
        return await _analyze_with_compliance_model(log_content)

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

    # 2. Local Ollama serving (if enabled)
    if settings.ollama_enabled:
        try:
            return await _analyze_with_ollama(log_content)
        except Exception as exc:
            logger.warning("Local Ollama analysis failed, falling back: %s", exc)

    # 3. No API key → mock
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

    # 4. cascadeflow available → use it
    if _cascade_agent is not None:
        return await _analyze_with_cascade(log_content)

    # 5. Direct Groq fallback
    return await _analyze_with_groq(log_content)


_DIFF_SYSTEM_PROMPT = """
You are Halcyon AI — an expert SRE specializing in code analysis and incident correlation.
Your task is to analyze a recent git commit diff and the raw log content from a production incident.
Determine whether the code change in the commit plausibly caused or contributed to the incident.

Assess the plausibility and return a structured JSON response with:
- plausibility: Must be one of HIGH | MEDIUM | LOW | UNRELATED.
- reason: A single sentence explaining the logical connection (or lack thereof) between the change and the logs.

Guidelines for Plausibility:
- HIGH: Direct connection. e.g., the commit changes a config parameter or code path that is explicitly failing in the logs.
- MEDIUM: Strong circumstantial connection. e.g., the commit modifies a service that is failing, but the exact error source is not clear from the diff alone.
- LOW: Weak connection. e.g., general changes in the same codebase but unlikely to cause this specific error.
- UNRELATED: The changes are in completely unrelated parts of the codebase, docs, or tests.

IMPORTANT: Return ONLY valid JSON — no markdown fences, no extra text.
"""


def _build_diff_prompt(log_content: str, commit_sha: str, commit_message: str, commit_diff: str) -> str:
    # Truncate content if too long
    max_log_chars = 4000
    if len(log_content) > max_log_chars:
        half = max_log_chars // 2
        log_content = log_content[:half] + "\n... [TRUNCATED] ...\n" + log_content[-half:]

    max_diff_chars = 6000
    if len(commit_diff) > max_diff_chars:
        commit_diff = commit_diff[:max_diff_chars] + "\n... [DIFF TRUNCATED] ...\n"

    return f"""--- INCIDENT LOGS ---
{log_content}

--- COMMIT DETAILS ---
SHA: {commit_sha}
Message: {commit_message}

--- COMMIT DIFF ---
{commit_diff}

Respond with ONLY the JSON object:"""


async def analyze_commit_diff(
    log_content: str,
    commit_sha: str,
    commit_message: str,
    commit_diff: str,
) -> tuple[dict, RoutingMetadata]:
    """
    Analyze whether a commit diff plausibly caused the incident.
    Returns (result_dict, routing_metadata) using the same cascadeflow / Groq architecture.
    """
    metadata = RoutingMetadata()
    
    # Predefined / mock fallback if no API key
    if _groq_client is None:
        metadata.model_used = "mock"
        metadata.model_tier = "mock"
        result = {"plausibility": "UNRELATED", "reason": "Mock analysis — no API key configured."}
        return result, metadata

    prompt = _build_diff_prompt(log_content, commit_sha, commit_message, commit_diff)

    if settings.cascadeflow_enabled and _cascade_agent is not None:
        metadata.cascadeflow_used = True
        start = time.perf_counter()
        try:
            result = await _cascade_agent.run(
                prompt,
                system_prompt=_DIFF_SYSTEM_PROMPT,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000
            metadata.latency_ms = round(elapsed_ms, 1)
            metadata.model_used = getattr(result, "model_used", settings.draft_model)
            metadata.cost = getattr(result, "total_cost", 0.0)
            if hasattr(result, "model_used") and result.model_used != settings.draft_model:
                metadata.escalated = True
                metadata.model_tier = "verifier"
                metadata.escalation_reason = "Quality validation triggered escalation to verifier model"
            else:
                metadata.model_tier = "drafter"
            
            metadata.decision_trace = {
                "draft_model": settings.draft_model,
                "verifier_model": settings.verifier_model,
                "model_used": metadata.model_used,
                "escalated": metadata.escalated,
                "cost": metadata.cost,
                "latency_ms": metadata.latency_ms,
                "cascadeflow_mode": settings.cascadeflow_mode,
                "type": "commit_correlation",
                "commit_sha": commit_sha,
            }
            raw_text = result.content if hasattr(result, "content") else str(result)
            cleaned = re.sub(r"```(?:json)?\s*", "", raw_text).strip().rstrip("`").strip()
            parsed = json.loads(cleaned)
            parsed["plausibility"] = parsed.get("plausibility", "UNRELATED").upper()
            return parsed, metadata
        except Exception as exc:
            logger.error("CascadeFlow commit analysis failed: %s — falling back to direct Groq", exc)

    # Fallback to direct Groq
    start = time.perf_counter()
    model_name = settings.verifier_model
    metadata.model_used = model_name
    metadata.model_tier = "direct"
    try:
        response = await asyncio.to_thread(
            _groq_client.chat.completions.create,
            model=model_name,
            messages=[
                {"role": "system", "content": _DIFF_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=512,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        metadata.latency_ms = round(elapsed_ms, 1)
        usage = getattr(response, "usage", None)
        if usage:
            total_tokens = getattr(usage, "total_tokens", 0)
            metadata.cost = total_tokens * 0.00000059

        metadata.decision_trace = {
            "model_used": model_name,
            "fallback": True,
            "reason": "Direct Groq call",
            "latency_ms": metadata.latency_ms,
            "cost": metadata.cost,
            "type": "commit_correlation",
            "commit_sha": commit_sha,
        }
        raw_text = response.choices[0].message.content
        cleaned = re.sub(r"```(?:json)?\s*", "", raw_text).strip().rstrip("`").strip()
        parsed = json.loads(cleaned)
        parsed["plausibility"] = parsed.get("plausibility", "UNRELATED").upper()
        return parsed, metadata
    except Exception as exc:
        logger.error("Groq API error in commit analysis: %s", exc)
        return {"plausibility": "UNRELATED", "reason": f"Analysis failed: {exc}"}, metadata


_SYNTHETIC_LOG_SYSTEM_PROMPT = """
You are a software debugging expert.
Analyze the provided git commit diff. If it introduces a bug, syntax error, or typo, generate the EXACT raw crash log or traceback that the compiler or runtime would throw.
If it is a typo in an import or variable, generate a NameError or ImportError traceback.

Return ONLY the raw traceback text. NO markdown formatting. NO backticks. NO ```python. NO conversational text.
If the commit is totally safe and introduces no bugs, return the exact word: CLEAN
"""


def _build_synthetic_log_prompt(diff_content: str, commit_message: str, changed_files: list) -> str:
    max_diff_chars = 4000
    if len(diff_content) > max_diff_chars:
        diff_content = diff_content[:max_diff_chars] + "\n... [DIFF TRUNCATED] ...\n"
    
    files_str = ", ".join(changed_files)
    
    return f"""--- COMMIT MESSAGE ---
{commit_message}

--- CHANGED FILES ---
{files_str}

--- COMMIT DIFF ---
{diff_content}

Generate the raw crash log now:"""


async def generate_synthetic_crash_log(
    diff_content: str,
    commit_message: str,
    changed_files: list,
) -> Optional[str]:
    """
    Generate a realistic crash log based on a commit diff using Groq or Local Ollama.
    Returns None if generation fails or no API key/local model is available.
    """
    prompt = _build_synthetic_log_prompt(diff_content, commit_message, changed_files)
    raw_text = ""

    if settings.ollama_enabled:
        import httpx
        headers = {
            "ngrok-skip-browser-warning": "true"
        }
        if settings.ollama_token:
            headers["Authorization"] = f"Bearer {settings.ollama_token}"
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.ollama_url}/v1/chat/completions",
                    json={
                        "model": settings.ollama_model,
                        "messages": [
                            {"role": "system", "content": _SYNTHETIC_LOG_SYSTEM_PROMPT},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.7,
                        "max_tokens": 2048,
                    },
                    headers=headers,
                    timeout=60.0,
                )
                response.raise_for_status()
                res_data = response.json()
                raw_text = res_data["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("Failed to generate synthetic crash log using Ollama: %s", exc)
            return None
    elif _groq_client is not None:
        try:
            response = await asyncio.to_thread(
                _groq_client.chat.completions.create,
                model=settings.draft_model, # Use the faster model for log generation
                messages=[
                    {"role": "system", "content": _SYNTHETIC_LOG_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7, # Slightly higher temperature for realistic variance
                max_tokens=2048, # Increased to prevent <think> block truncation
            )
            raw_text = response.choices[0].message.content
        except Exception as exc:
            logger.error("Failed to generate synthetic crash log using Groq: %s", exc)
            return None
    else:
        logger.warning("No LLM available (Ollama off, no Groq key) for diff analysis.")
        return None

    try:
        # Remove <think> blocks if present, even if unclosed due to truncation
        raw_text = re.sub(r"<think>.*?(?:</think>|$)", "", raw_text, flags=re.DOTALL).strip()
        # Clean up any accidental markdown
        cleaned = re.sub(r"^```[a-zA-Z]*\n", "", raw_text)
        cleaned = re.sub(r"\n```$", "", cleaned).strip()
        if cleaned.upper() == "CLEAN":
            logger.info("Commit classified as CLEAN by LLM. No incident generated.")
            return "CLEAN"
        return cleaned
    except Exception as exc:
        logger.error("Failed to parse synthetic crash log: %s", exc)
        return None
