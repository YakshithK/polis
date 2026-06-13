import json
import logging
import os

from openai import AsyncOpenAI

from backend.models.event import MatchEvent

logger = logging.getLogger(__name__)

_FALLBACK_TIMELINE = [
    {"minute": 8,  "type": "goal",             "team": "canada",   "severity": 0.9},
    {"minute": 23, "type": "var_review",        "team": "canada",   "severity": 0.5},
    {"minute": 37, "type": "red_card",          "team": "opponent", "severity": 0.7},
    {"minute": 54, "type": "goal",              "team": "opponent", "severity": 0.85},
    {"minute": 71, "type": "penalty_miss",      "team": "canada",   "severity": 0.6},
    {"minute": 88, "type": "goal",              "team": "canada",   "severity": 1.0},
]

_SYSTEM = (
    "You are a FIFA World Cup 2026 match director. "
    "Output ONLY a valid JSON array — no prose, no markdown, no code fences. "
    "Each element: {\"minute\": int 1-90, \"type\": one of [goal, red_card, var_review, penalty_miss, elimination, championship_win], "
    "\"team\": one of [canada, opponent], \"severity\": float 0.0-1.0}. "
    "Events must be chronologically ordered. Generate 6-8 events total."
)


async def generate_timeline(context: str, expressive: bool = False) -> list[MatchEvent]:
    key = os.getenv("HACKCLUB_API_KEY") or os.getenv("HACKCLUB_AI_KEY") or ""
    client = AsyncOpenAI(api_key=key, base_url="https://ai.hackclub.com/proxy/v1")

    style = (
        "Create a dramatic, unpredictable match with surprising swings — red cards, late goals, high severity events."
        if expressive else
        "Create a realistic, balanced match progression with gradual momentum shifts."
    )

    try:
        response = await client.chat.completions.create(
            model="google/gemini-2.5-flash",
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": f"Context: {context}\nStyle: {style}\nGenerate the match timeline JSON array now."},
            ],
            max_tokens=600,
            temperature=0.9 if expressive else 0.3,
        )
        raw = response.choices[0].message.content or ""
        raw = raw.strip()
        # Strip markdown fences if model wrapped output
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        events_data = json.loads(raw)
        events = [MatchEvent(**e) for e in events_data]
        events.sort(key=lambda e: e.minute)
        logger.info("Director generated %d events (%s)", len(events), "expressive" if expressive else "conservative")
        return events
    except Exception as exc:
        logger.warning("Director AI failed, using fallback timeline: %s", exc)
        return [MatchEvent(**e) for e in _FALLBACK_TIMELINE]
