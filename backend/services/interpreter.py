import asyncio
import json
import logging

from backend.models.event import MatchEvent
from backend.services.narrator import _get_client, _get_sem

logger = logging.getLogger(__name__)

INTERPRET_SYSTEM = """You are a Toronto city event interpreter for a living city simulation.
Map the user's text to a structured city event. Output ONLY valid JSON, no markdown.

Standard types: transit_strike, heat_wave, festival, power_outage, major_layoffs, cultural_event, protest, street_fair
For neighborhood atmosphere events: use type "community_gathering" or "local_incident"

Output schema:
{
    "type": "festival",
    "team": null,
    "minute": 78,
    "severity": 0.85,
    "duration": 45,
    "description": "A street festival pops up downtown",
    "organic_districts": null,
    "custom_effects": null
}"""


async def interpret_natural_event(text: str, current_minute: int = 1) -> dict:
    client = _get_client()

    try:
        async with _get_sem():
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model="google/gemini-2.5-flash-lite",
                    messages=[
                        {"role": "system", "content": INTERPRET_SYSTEM},
                        {"role": "user", "content": text},
                    ],
                    temperature=0.1,
                    max_tokens=200,
                ),
                timeout=10.0,
            )
        raw = response.choices[0].message.content.strip()
        data = json.loads(raw)

        event = MatchEvent(
            type=data["type"],
            team=data.get("team"),
            minute=data.get("minute") or current_minute,
            severity=float(data.get("severity", 0.6)),
            duration=data.get("duration"),
        )
        return {
            "event": event,
            "description": data.get("description", text),
            "custom_effects": data.get("custom_effects"),
        }
    except Exception:
        logger.warning("NL interpretation failed, falling back to organic event")
        return {
            "event": MatchEvent(type="community_gathering", team=None, minute=current_minute, severity=0.5),
            "description": text,
            "custom_effects": None,
        }
