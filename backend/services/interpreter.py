import json
import logging
import os

from openai import AsyncOpenAI

from backend.models.event import MatchEvent

logger = logging.getLogger(__name__)

INTERPRET_SYSTEM = """You are a World Cup match event interpreter for a Toronto city simulation.
Map the user's text to a structured match event. Output ONLY valid JSON, no markdown.

Standard types: goal, red_card, var_review, penalty_miss, elimination, championship_win
For city/atmosphere events: use type "organic"

Output schema:
{
  "type": "goal",
  "team": "canada",
  "minute": 78,
  "severity": 0.85,
  "description": "Canada scores a header",
  "organic_districts": null,
  "custom_effects": null
}"""


async def interpret_natural_event(text: str, current_minute: int = 1) -> dict:
    key = os.getenv("HACKCLUB_API_KEY") or os.getenv("HACKCLUB_AI_KEY") or ""
    client = AsyncOpenAI(api_key=key, base_url="https://ai.hackclub.com/proxy/v1")

    try:
        response = await client.chat.completions.create(
            model="google/gemini-2.5-flash-lite",
            messages=[
                {"role": "system", "content": INTERPRET_SYSTEM},
                {"role": "user", "content": text},
            ],
            temperature=0.1,
            max_tokens=200,
            timeout=4.0,
        )
        raw = response.choices[0].message.content.strip()
        data = json.loads(raw)

        event = MatchEvent(
            type=data["type"],
            team=data.get("team"),
            minute=data.get("minute") or current_minute,
            severity=float(data.get("severity", 0.6)),
        )
        return {
            "event": event,
            "description": data.get("description", text),
            "custom_effects": data.get("custom_effects"),
        }
    except Exception:
        logger.warning("NL interpretation failed, falling back to organic event")
        return {
            "event": MatchEvent(type="organic", team=None, minute=current_minute, severity=0.5),
            "description": text,
            "custom_effects": None,
        }
