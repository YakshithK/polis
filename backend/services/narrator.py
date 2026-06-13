import asyncio
import logging
import os

from openai import AsyncOpenAI

from backend.models.district import DistrictState
from backend.models.event import MatchEvent
from backend.services.characters import pick_character

logger = logging.getLogger(__name__)

def _get_client() -> AsyncOpenAI:
    key = os.getenv("HACKCLUB_API_KEY") or os.getenv("HACKCLUB_AI_KEY") or ""
    return AsyncOpenAI(
        api_key=key,
        base_url="https://ai.hackclub.com/proxy/v1",
    )

_EVENT_LABELS = {
    ("goal", "canada"): "Canada scored a goal",
    ("goal", "opponent"): "The opponent scored a goal",
    ("red_card", "canada"): "Canada got a red card",
    ("red_card", "opponent"): "The opponent got a red card",
    ("var_review", "canada"): "VAR is reviewing a Canada play",
    ("penalty_miss", "canada"): "Canada missed a penalty",
    ("penalty_miss", "opponent"): "The opponent missed a penalty",
    ("elimination", "canada"): "Canada has been eliminated from the World Cup",
    ("championship_win", "canada"): "Canada won the World Cup championship",
}

_FALLBACKS = {
    ("goal", "canada"): [
        "The streets are ELECTRIC right now 🇨🇦⚽ #CanadaFC",
        "CANADA SCORES!! This city is going absolutely wild 🔥",
        "Roads are shutdown with celebrations, absolute madness here",
    ],
    ("goal", "opponent"): [
        "Gutted. Dead silence in the stands now 😔 #CanadaFC",
        "That goal hurt. Everyone's gone quiet on the streets.",
        "Mood has completely dropped here. Come on Canada 😤",
    ],
    ("red_card", "canada"): [
        "Oh no, red card. Down to 10 men, this is rough 😬 #CanadaFC",
        "Terrible decision but the boys gotta push through",
    ],
    ("var_review", "canada"): [
        "VAR check... everyone holding their breath right now 👀",
        "The tension here is unreal while we wait on this review",
    ],
    ("elimination", "canada"): [
        "Heartbreak. Canada is out. The streets are silent now 💔",
        "We gave everything. So proud but hurting right now 🇨🇦",
    ],
    ("championship_win", "canada"): [
        "CANADA WORLD CHAMPIONS 🏆🇨🇦 THIS IS HISTORY!!!",
        "Greatest moment in Canadian sport history. Absolute mayhem here",
    ],
    ("penalty_miss", "canada"): [
        "Penalty missed... so close. Heads up, we're still in this",
        "Heart dropped. Come on Canada, recover from this 😬",
    ],
}

async def generate_feed_text(event: MatchEvent, state: DistrictState) -> tuple[str, str]:
    """Return (post_text, character_name)."""
    event_label = _EVENT_LABELS.get(
        (event.type, event.team),
        f"{event.team} {event.type.replace('_', ' ')}"
    )
    district_name = state.district_id.replace("_", " ").title()
    emotion = state.emotion
    dominant = state.dominant
    char = pick_character(state.district_id)

    system = (
        f"You are {char['name']}, a resident of {district_name}, Toronto, watching FIFA World Cup 2026. "
        f"Voice: {char['voice']}. "
        "Write exactly ONE social media post reacting to the match event. Max 120 characters. "
        "Stay completely in character. Output only the post text, nothing else. No hashtag spam."
    )
    user = (
        f"Event: {event_label} (minute {event.minute})\n"
        f"Your neighbourhood mood: {dominant} — "
        f"excitement={emotion.excitement:.0f}, tension={emotion.tension:.0f}, "
        f"frustration={emotion.frustration:.0f}, pride={emotion.pride:.0f}"
    )

    try:
        client = _get_client()
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="google/gemini-2.5-flash-lite",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=80,
                temperature=0.9,
            ),
            timeout=8.0,
        )
        text = response.choices[0].message.content or ""
        return text.strip(), char["name"]
    except Exception as exc:
        logger.warning("Narrator AI call failed for %s: %s", state.district_id, exc)
        return _fallback(event), char["name"]


def _fallback(event: MatchEvent) -> str:
    options = _FALLBACKS.get((event.type, event.team))
    if options:
        import hashlib, time
        idx = int(hashlib.md5(str(time.time()).encode()).hexdigest(), 16) % len(options)
        return options[idx]
    return f"Something big just happened at minute {event.minute} — the city is reacting."


def pick_key_districts(
    influenced: list[tuple[DistrictState, int]],
    scenario_alignments: dict,
) -> list[DistrictState]:
    """Return up to 3 districts: highest canada_support, lowest canada_support, downtown."""
    states = [s for s, _ in influenced]
    by_support = sorted(
        states,
        key=lambda s: scenario_alignments.get(s.district_id, {}).get("canada_support", 50),
    )
    chosen: list[DistrictState] = []
    seen: set[str] = set()

    for candidate in [by_support[-1], by_support[0]]:
        if candidate.district_id not in seen:
            chosen.append(candidate)
            seen.add(candidate.district_id)

    downtown = next((s for s in states if s.district_id == "downtown"), None)
    if downtown and downtown.district_id not in seen:
        chosen.append(downtown)

    return chosen
