"""
cascadeflow — Local stub implementation
Provides CascadeAgent and ModelConfig matching the interface expected by ai.py.

Routing strategy:
  1. Call the cheap "drafter" model first.
  2. Score the draft response for basic quality (valid JSON, required fields).
  3. If the draft passes → return it immediately (saves cost).
  4. If the draft fails quality check → escalate to the "verifier" model.
"""
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Public data models
# ---------------------------------------------------------------------------

@dataclass
class ModelConfig:
    """Configuration for a single model tier."""
    name: str
    provider: str = "groq"
    cost: float = 0.0          # cost per token (used for billing estimates)


@dataclass
class CascadeResult:
    """Result returned by CascadeAgent.run()."""
    content: str               # Raw LLM text output
    model_used: str            # Which model produced the final answer
    total_cost: float          # Estimated cost in USD
    escalated: bool            # Whether the verifier was invoked
    savings_percentage: float  # % saved vs always using the verifier
    draft_used: bool           # Whether a draft was attempted
    latency_ms: float          # Total wall-clock time in ms
    decision_trace: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Quality scorer
# ---------------------------------------------------------------------------

_REQUIRED_FIELDS = {"root_cause", "severity", "fix_suggestion", "summary",
                    "affected_components", "confidence_score"}

def _score_draft(text: str) -> float:
    """
    Return a quality score 0.0–1.0 for a raw LLM response.
    Checks whether the response is valid JSON containing all required fields.
    """
    # Strip markdown fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return 0.0   # Invalid JSON → must escalate

    present = _REQUIRED_FIELDS & set(data.keys())
    field_score = len(present) / len(_REQUIRED_FIELDS)

    # Bonus: confidence_score should be a number in [0, 1]
    try:
        cs = float(data.get("confidence_score", 0))
        cs_ok = 1.0 if 0.0 <= cs <= 1.0 else 0.0
    except (TypeError, ValueError):
        cs_ok = 0.0

    # Bonus: severity must be valid
    severity = str(data.get("severity", "")).upper()
    severity_ok = 1.0 if severity in {"LOW", "MEDIUM", "HIGH", "CRITICAL"} else 0.0

    return round((field_score * 0.6) + (cs_ok * 0.2) + (severity_ok * 0.2), 3)


# QUALITY_THRESHOLD: drafts scoring below this are escalated to the verifier
QUALITY_THRESHOLD = 0.75


# ---------------------------------------------------------------------------
# CascadeAgent
# ---------------------------------------------------------------------------

class CascadeAgent:
    """
    Draft-then-verify routing agent.

    models[0] → drafter  (cheap, fast)
    models[1] → verifier (capable, more expensive)
    """

    def __init__(self, models: List[ModelConfig]):
        if len(models) < 2:
            raise ValueError("CascadeAgent requires at least 2 ModelConfig entries "
                             "(drafter + verifier).")
        self.drafter: ModelConfig = models[0]
        self.verifier: ModelConfig = models[1]

    # ------------------------------------------------------------------
    # Internal Groq caller (sync — wrapped via asyncio.to_thread by caller)
    # ------------------------------------------------------------------

    @staticmethod
    def _call_groq(model_name: str, system_prompt: str,
                   user_prompt: str) -> tuple[str, int]:
        """Call Groq and return (content, total_tokens)."""
        try:
            from groq import Groq
            from config import settings
            client = Groq(api_key=settings.groq_api_key)
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=1024,
            )
            content = response.choices[0].message.content or ""
            tokens = getattr(getattr(response, "usage", None), "total_tokens", 0)
            return content, tokens
        except Exception as exc:
            logger.error("CascadeAgent _call_groq(%s) failed: %s", model_name, exc)
            raise

    # ------------------------------------------------------------------
    # Public async interface
    # ------------------------------------------------------------------

    async def run(
        self,
        prompt: str,
        system_prompt: str = "",
    ) -> CascadeResult:
        """
        Run the cascade:
          1. Draft with the cheap model.
          2. Score the draft.
          3. If quality >= threshold → return draft result.
          4. Otherwise → call verifier and return that result.
        """
        import asyncio

        verifier_cost_per_token = self.verifier.cost
        drafter_cost_per_token  = self.drafter.cost
        wall_start = time.perf_counter()

        # ── Step 1: Draft ───────────────────────────────────────────────
        logger.info("CascadeAgent: calling drafter (%s)…", self.drafter.name)
        draft_start = time.perf_counter()
        try:
            draft_text, draft_tokens = await asyncio.to_thread(
                self._call_groq, self.drafter.name, system_prompt, prompt
            )
        except Exception as exc:
            # If drafter fails entirely, go straight to verifier
            logger.warning("Drafter failed (%s), escalating immediately: %s",
                           self.drafter.name, exc)
            draft_text, draft_tokens = "", 0

        draft_ms = (time.perf_counter() - draft_start) * 1000
        draft_cost = draft_tokens * drafter_cost_per_token

        # ── Step 2: Score ───────────────────────────────────────────────
        quality = _score_draft(draft_text)
        logger.info("CascadeAgent: draft quality=%.3f (threshold=%.2f)",
                    quality, QUALITY_THRESHOLD)

        # ── Step 3: Return draft if good enough ─────────────────────────
        if quality >= QUALITY_THRESHOLD and draft_text:
            total_ms = (time.perf_counter() - wall_start) * 1000
            # Savings = what we would have paid for the verifier minus draft cost
            hypothetical_verifier_cost = draft_tokens * verifier_cost_per_token
            savings_pct = max(0.0, round(
                (1 - draft_cost / max(hypothetical_verifier_cost, 1e-9)) * 100, 1
            ))
            logger.info("CascadeAgent: draft accepted — model=%s, savings=%.1f%%",
                        self.drafter.name, savings_pct)
            return CascadeResult(
                content=draft_text,
                model_used=self.drafter.name,
                total_cost=draft_cost,
                escalated=False,
                savings_percentage=savings_pct,
                draft_used=True,
                latency_ms=round(total_ms, 1),
                decision_trace={
                    "draft_quality": quality,
                    "threshold": QUALITY_THRESHOLD,
                    "escalated": False,
                    "draft_model": self.drafter.name,
                    "draft_tokens": draft_tokens,
                    "draft_cost": draft_cost,
                    "draft_ms": round(draft_ms, 1),
                },
            )

        # ── Step 4: Escalate to verifier ────────────────────────────────
        logger.info("CascadeAgent: escalating to verifier (%s), draft quality=%.3f",
                    self.verifier.name, quality)
        ver_start = time.perf_counter()
        ver_text, ver_tokens = await asyncio.to_thread(
            self._call_groq, self.verifier.name, system_prompt, prompt
        )
        ver_ms = (time.perf_counter() - ver_start) * 1000
        ver_cost = ver_tokens * verifier_cost_per_token

        total_cost = draft_cost + ver_cost
        total_ms   = (time.perf_counter() - wall_start) * 1000

        # Savings compared to having gone straight to verifier with full tokens
        pure_verifier_cost = ver_tokens * verifier_cost_per_token
        savings_pct = max(0.0, round(
            (1 - total_cost / max(pure_verifier_cost, 1e-9)) * 100, 1
        ))

        logger.info("CascadeAgent: verifier accepted — model=%s, total_cost=$%.6f",
                    self.verifier.name, total_cost)
        return CascadeResult(
            content=ver_text,
            model_used=self.verifier.name,
            total_cost=total_cost,
            escalated=True,
            savings_percentage=savings_pct,
            draft_used=True,
            latency_ms=round(total_ms, 1),
            decision_trace={
                "draft_quality": quality,
                "threshold": QUALITY_THRESHOLD,
                "escalated": True,
                "draft_model": self.drafter.name,
                "draft_tokens": draft_tokens,
                "draft_cost": draft_cost,
                "draft_ms": round(draft_ms, 1),
                "verifier_model": self.verifier.name,
                "verifier_tokens": ver_tokens,
                "verifier_cost": ver_cost,
                "verifier_ms": round(ver_ms, 1),
            },
        )
