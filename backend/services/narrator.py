import asyncio
import logging
import os

from openai import AsyncOpenAI

from backend.models.district import DistrictState
from backend.models.event import MatchEvent
from backend.services.characters import pick_character, trim_voice

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None
_sem: asyncio.Semaphore | None = None

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        key = os.getenv("HACKCLUB_API_KEY") or os.getenv("HACKCLUB_AI_KEY") or ""
        _client = AsyncOpenAI(
            api_key=key,
            base_url="https://ai.hackclub.com/proxy/v1",
            timeout=30.0,
        )
    return _client

def _get_sem() -> asyncio.Semaphore:
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(4)
    return _sem

_EVENT_LABELS = {
    ("transit_strike", None): "Transit strike hits the city",
    ("heat_wave", None): "Heat wave grips Toronto",
    ("festival", None): "A festival spills into the streets",
    ("power_outage", None): "A power outage is affecting the neighborhood",
    ("major_layoffs", None): "Major layoffs are shaking the city",
    ("cultural_event", None): "A cultural event is drawing crowds",
    ("protest", None): "A protest is building downtown",
    ("street_fair", None): "A street fair fills the block",
    ("street_party", None): "A street party is forming on the block",
    ("city_buzz", None): "A buzz is spreading through the neighbourhood",
    ("neighbourhood_chatter", None): "Neighbours are chatting in the streets",
    ("street_party_forming", None): "A massive street party is starting",
    ("local_incident", None): "A local incident is disrupting the block",
    ("community_gathering", None): "Residents are gathering in the neighborhood",
}

_HARDCODED_POSTS: dict[str, list[str]] = {
    "transit_strike": [
        "TTC is cooked today. Absolutely cooked.",
        "Standing at the stop for 25 mins. I could've walked.",
        "They really did this to us. No warning, nothing.",
        "No bus, no train, no explanation. Classic.",
        "Working from home it is. TTC lost today.",
        "The audacity of this city sometimes I swear.",
        "Took my bike. No regrets.",
        "Group chat going OFF about the transit situation rn.",
    ],
    "heat_wave": [
        "It is physically too hot to exist outside right now.",
        "Walked out for 4 seconds and turned right back around.",
        "The city is a literal oven. I can't.",
        "Everyone is slow, everyone is sweating. Summer is a scam.",
        "AC at the library is calling my name.",
        "How is Toronto this hot. We don't deserve this.",
        "My building has no AC. I'm melting. Send help.",
        "Hot enough to fry an egg on the sidewalk fr.",
    ],
    "street_party": [
        "THE BLOCK IS OUT RIGHT NOW",
        "Someone pulled speakers out front and now we're partying.",
        "This street just became a whole celebration.",
        "Didn't have plans tonight but the neighbourhood had plans for me.",
        "Block party energy has taken over. I love this city.",
        "Came outside for air. Stayed for the vibes.",
        "This is why I live here. Moments like this.",
        "Everyone's out, music's up, life is good right now.",
    ],
    "street_party_forming": [
        "Something is forming on this block and it's getting loud.",
        "The energy out here is building fast.",
        "Street is closing itself. Nobody's going home.",
        "This is turning into something. I can feel it.",
        "We started with 10 people. Now there's a hundred.",
        "Block is alive tonight. Actually alive.",
    ],
    "festival": [
        "The whole neighbourhood just lit up. Festival mode.",
        "Streets are packed and the energy is unreal.",
        "Only in Toronto does a Tuesday become this.",
        "Noise complaint filed: happiness.",
        "You can feel the city breathing differently today.",
        "This city knows how to throw it down.",
        "Walked right into a festival. Plans cancelled themselves.",
        "The vibe on these streets right now is something special.",
    ],
    "power_outage": [
        "Power's out and everyone's suddenly neighbours.",
        "No lights on the block. It's weirdly peaceful.",
        "Called my landlord. Called the city. Called my mom.",
        "This is how you find out who has candles.",
        "Everything went dark. Someone yelled 'yo is everyone okay'.",
        "Block going analogue tonight. Kinda love it.",
        "Power outage got the whole street outside talking.",
        "Checking on neighbours while my phone dies. Very Toronto.",
    ],
    "major_layoffs": [
        "The mood out here is heavy today.",
        "A lot of people I know got bad news today.",
        "City feels different when people are scared about money.",
        "Hoping everyone lands somewhere good.",
        "Days like today remind you how fragile things are.",
        "Stress in the air across the whole neighbourhood.",
        "Nobody's okay today. That's just the truth.",
        "Thinking about everyone who got that call today.",
    ],
    "cultural_event": [
        "This neighbourhood is showing out today and I'm here for it.",
        "Proud doesn't cover it. This is something else.",
        "The culture is alive and well in this city.",
        "Days like today remind me why I moved here.",
        "Energy on these streets is pure love right now.",
        "Toronto being Toronto in the best possible way.",
        "Loud, proud, absolutely unhinged. Love it.",
        "The community showed UP today.",
    ],
    "protest": [
        "People are out here making noise and they have a point.",
        "The block is loud tonight and it should be.",
        "Hard to ignore what's happening a few streets over.",
        "Whole city paying attention to this right now.",
        "Something shifted in the energy downtown.",
        "Streets are sending a message right now.",
        "Can't look away. Nor should anyone.",
        "Toronto's got something to say today.",
    ],
    "street_fair": [
        "Block turned into a whole afternoon.",
        "Funnel cake, live music, the works. Classic.",
        "Street fair has me in a great mood for no reason.",
        "This block knows how to do it.",
        "Kids are running, vendors are loud. It's perfect.",
        "Days like today are why you live in a neighbourhood.",
        "Found my dinner, my dessert, and my plans all in one block.",
        "This is the Toronto I love.",
    ],
    "community_gathering": [
        "Everyone just came outside at the same time. It's nice.",
        "Block feels like a block again today.",
        "Spontaneous gathering and nobody planned it.",
        "This is the version of the city I love most.",
        "Neighbours I've never met, met today.",
        "Quiet little moment the whole street will remember.",
        "Just people checking in. Simple as that.",
        "The city as a community, not just buildings.",
    ],
    "local_incident": [
        "Something's happening nearby. People are watching.",
        "Not sure what's going on but the vibe shifted.",
        "Block got tense real quick.",
        "Stay aware out there tonight.",
        "Bit of a situation on the street right now.",
        "Everyone's a little on edge around here.",
        "Something small turned into something bigger. Happens.",
        "It's fine. Probably fine. The neighbourhood handles it.",
    ],
    "city_buzz": [
        "Something's in the air tonight and I can feel it.",
        "The city has a specific energy right now. Hard to explain.",
        "Toronto is alive tonight. You can just feel it.",
        "Streets feel electric for some reason.",
        "Everyone seems more energized than usual.",
        "Vibe check: the city is buzzing.",
        "Everything feels heightened out there right now.",
        "Just got outside. The city has a whole mood rn.",
    ],
    "neighbourhood_chatter": [
        "Group chat is going wild. Everyone has opinions.",
        "Ran into three neighbours in a row. Everyone talking.",
        "The block is chatty today in the best way.",
        "Neighbourhood gossip in full effect.",
        "Everyone on my street is suddenly very talkative.",
        "This is the street energy I signed up for.",
        "Three conversations at once. I love it here.",
        "Word travels fast on this block.",
    ],
}

_AMBIENT_FALLBACKS: dict[str, list[str]] = {
    "excitement": [
        "Feeling that Toronto energy tonight.",
        "Something good is happening in this neighbourhood.",
        "The block is alive right now. No notes.",
        "City's got a great mood going. Soaking it in.",
    ],
    "tension": [
        "Bit of an edge to the neighbourhood right now.",
        "Something in the air — everyone's a little on edge.",
        "Stress is kind of everywhere right now.",
        "The city feels coiled up tonight.",
    ],
    "frustration": [
        "People are fed up and it shows.",
        "The vibe on this block is a collective sigh.",
        "Nobody's having the best day. We're getting through it.",
        "Frustrated energy all over the neighbourhood.",
    ],
    "pride": [
        "Real community pride on these streets today.",
        "This neighbourhood is doing something right.",
        "Love where I live, especially on days like today.",
        "There's something warm about this block right now.",
    ],
}


def _one_sentence(text: str) -> str:
    sentence = text.strip().replace("\n", " ")
    if not sentence:
        return text.strip()
    for splitter in ["!", "?", "."]:
        idx = sentence.find(splitter)
        if idx > -1:
            sentence = sentence[: idx + 1]
            break
    return sentence[:140].strip()


async def _chat_text(*, model: str, system: str, user: str, timeout: float, temperature: float) -> str:
    async with _get_sem():
        client = _get_client()
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                max_tokens=120,
                temperature=temperature,
            ),
            timeout=timeout,
        )
        return (response.choices[0].message.content or "").strip()


async def generate_district_archetype(
    district_state: DistrictState,
    *,
    last_event_type: str | None,
    scenario_context: str,
) -> str:
    emotion = district_state.emotion
    system = "You are summarizing a Toronto neighborhood's current activity in one short sentence. Output only the sentence, no quotation marks."
    user = (
        f"District: {district_state.district_id}\n"
        f"Context: {scenario_context}\n"
        f"Recent event: {last_event_type or 'none'}\n"
        f"Mood: happiness={emotion.excitement:.0f}, stress={emotion.tension:.0f}, pride={emotion.pride:.0f}, frustration={emotion.frustration:.0f}\n"
        "Describe what people in this neighborhood are doing right now in one sentence."
    )
    try:
        return _one_sentence(await _chat_text(model="google/gemini-2.5-flash", system=system, user=user, timeout=12.0, temperature=0.4))
    except Exception as exc:
        logger.warning("District archetype AI failed for %s: %s(%s)", district_state.district_id, type(exc).__name__, exc)
        return f"People in {district_state.district_id.replace('_', ' ').title()} are reacting to the city in their own way."


async def generate_citizen_activity(
    *,
    citizen_name: str,
    voice: str,
    district_id: str,
    archetype: str,
    memories: list[str],
    last_event_type: str | None,
) -> str:
    system = (
        f"You are {citizen_name}, a Toronto resident. Voice: {trim_voice(voice, 2)}. "
        "Output exactly one sentence about what you are doing right now."
    )
    memory_lines = "\n".join(f"- {item}" for item in memories[-3:]) or "- none"
    user = (
        f"Neighborhood: {district_id}\n"
        f"Neighborhood activity: {archetype}\n"
        f"Recent event: {last_event_type or 'none'}\n"
        f"Previous memories:\n{memory_lines}\n"
        "Say what you are doing right now in first person or a natural close third-person style."
    )
    try:
        text = await _chat_text(model="google/gemini-2.5-flash-lite", system=system, user=user, timeout=8.0, temperature=0.7)
        return _one_sentence(text) or f"{citizen_name} is keeping up with city life."
    except Exception as exc:
        logger.warning("Citizen activity AI failed for %s: %s", citizen_name, exc)
        return f"{citizen_name} is caught up in the chaos like everyone else"


_AI_ONLY_EVENTS = {"organic"}  # only these event types go to AI; everything else uses hardcoded pool

def _pick_hardcoded(event_type: str) -> str:
    import random
    options = _HARDCODED_POSTS.get(event_type)
    if options:
        return random.choice(options)
    return "The city is reacting to what's happening right now."


async def generate_feed_text(event: MatchEvent, state: DistrictState) -> tuple[str, str]:
    """Return (post_text, character_name). Hardcoded for all preset event types."""
    char = pick_character(state.district_id)

    # For all non-organic events: use hardcoded pool (zero AI calls, zero rate-limit risk)
    if event.type not in _AI_ONLY_EVENTS:
        return _pick_hardcoded(event.type), char["name"]

    # Organic / natural events: try AI, fall back to pool
    district_name = state.district_id.replace("_", " ").title()
    emotion = state.emotion
    dominant = state.dominant
    system = (
        f"You are {char['name']}, a resident of {district_name}, Toronto. "
        f"Voice: {char['voice']}. "
        "Write exactly ONE social media post reacting to the city event. Max 120 characters. "
        "Output only the post text, nothing else."
    )
    user = (
        f"Event: {event.type.replace('_', ' ')} (minute {event.minute})\n"
        f"Mood: {dominant} — excitement={emotion.excitement:.0f}, tension={emotion.tension:.0f}"
    )
    try:
        text = await _chat_text(model="google/gemini-2.5-flash-lite", system=system, user=user, timeout=8.0, temperature=0.9)
        return (text or _pick_hardcoded(event.type)), char["name"]
    except Exception as exc:
        logger.warning("Narrator AI call failed for %s: %s", state.district_id, exc)
        return _pick_hardcoded(event.type), char["name"]


def pick_key_districts(
    influenced: list[tuple[DistrictState, int]],
    scenario_alignments: dict,
) -> list[DistrictState]:
    """Return up to 3 districts: highest excitement, lowest excitement, and downtown."""
    states = [s for s, _ in influenced]
    by_excitement = sorted(states, key=lambda s: s.emotion.excitement)
    chosen: list[DistrictState] = []
    seen: set[str] = set()

    for candidate in [by_excitement[-1], by_excitement[0]]:
        if candidate.district_id not in seen:
            chosen.append(candidate)
            seen.add(candidate.district_id)

    downtown = next((s for s in states if s.district_id == "downtown"), None)
    if downtown and downtown.district_id not in seen:
        chosen.append(downtown)

    return chosen


async def generate_ambient_post(state: DistrictState, clock_minute: int) -> tuple[str, str]:
    """Return (ambient_text, character_name) for general vibe posts between events."""
    import random
    char = pick_character(state.district_id)
    dominant = state.dominant

    def _ambient_fallback() -> str:
        options = _AMBIENT_FALLBACKS.get(dominant, [f"The vibe in this neighbourhood is {dominant} right now."])
        return random.choice(options)

    district_name = state.district_id.replace("_", " ").title()
    emotion = state.emotion
    system = (
        f"You are {char['name']}, a resident of {district_name}, Toronto. "
        f"Voice: {char['voice']}. "
        "Write exactly ONE social media post about the general vibe of your neighbourhood. "
        "Under 120 characters. Output only the post text, no hashtags."
    )
    user = (
        f"Clock: {clock_minute} min. Mood: {dominant} — "
        f"excitement={emotion.excitement:.0f}, tension={emotion.tension:.0f}, "
        f"frustration={emotion.frustration:.0f}, pride={emotion.pride:.0f}"
    )
    try:
        text = await _chat_text(model="google/gemini-2.5-flash-lite", system=system, user=user, timeout=8.0, temperature=0.7)
        return (text or _ambient_fallback()), char["name"]
    except Exception as exc:
        logger.warning("Ambient AI call failed for %s: %s", state.district_id, exc)
        return _ambient_fallback(), char["name"]

