import json
import logging
import os

from openai import AsyncOpenAI

from backend.models.event import MatchEvent

logger = logging.getLogger(__name__)

_FALLBACK_TIMELINE = [
    {"minute": 8,  "type": "festival",         "team": None, "severity": 0.9},
    {"minute": 23, "type": "protest",          "team": None, "severity": 0.5},
    {"minute": 37, "type": "power_outage",     "team": None, "severity": 0.7},
    {"minute": 54, "type": "heat_wave",        "team": None, "severity": 0.85},
    {"minute": 71, "type": "major_layoffs",    "team": None, "severity": 0.6},
    {"minute": 88, "type": "cultural_event",   "team": None, "severity": 1.0},
]

_SYSTEM = (
    "You are a Toronto city event director for a living city simulation. "
    "Output ONLY a valid JSON array — no prose, no markdown, no code fences. "
    "Each element: {\"minute\": int 1-90, \"type\": one of [transit_strike, heat_wave, festival, power_outage, major_layoffs, cultural_event, protest, street_fair], "
    "\"team\": null or a side label, \"severity\": float 0.0-1.0}. "
    "Events must be chronologically ordered. Generate 6-8 events total. "
    "Never schedule events at minute 45 (halftime) or minute 90 (full time)."
)


def _filter_halftime_minutes(events: list[MatchEvent]) -> list[MatchEvent]:
    """Drop events on blocked match-clock minutes."""
    return [e for e in events if e.minute not in (45, 90)]


async def generate_timeline(context: str, expressive: bool = False) -> list[MatchEvent]:
    key = os.getenv("HACKCLUB_API_KEY") or os.getenv("HACKCLUB_AI_KEY") or ""
    client = AsyncOpenAI(api_key=key, base_url="https://ai.hackclub.com/proxy/v1")

    style = (
        "Create a dramatic, unpredictable city day with strong swings — strikes, outages, protests, and celebrations."
        if expressive else
        "Create a realistic, balanced city event progression with gradual momentum shifts."
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
        events = _filter_halftime_minutes([MatchEvent(**e) for e in events_data])
        events.sort(key=lambda e: e.minute)
        logger.info("Director generated %d events (%s)", len(events), "expressive" if expressive else "conservative")
        return events
    except Exception as exc:
        logger.warning("Director AI failed, using fallback timeline: %s", exc)
        return _filter_halftime_minutes([MatchEvent(**e) for e in _FALLBACK_TIMELINE])
