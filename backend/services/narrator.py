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

_DISTRICT_ARCHETYPES: dict[str, dict[str, str]] = {
    "downtown": {
        "excitement": "People spilling out onto King and Bay like the city itself woke up.",
        "tension": "Something's off downtown. People walking fast, not stopping. Eyes down.",
        "frustration": "The mood on Bay Street is heavy. Nobody's moving fast right now.",
        "pride": "Nathan Phillips Square has something going. People are staying.",
    },
    "yorkville": {
        "excitement": "Bloor Street has come alive. Even the patios have patios right now.",
        "tension": "The usual Yorkville calm is slightly less calm today.",
        "frustration": "A few empty tables at spots that are never empty. Telling.",
        "pride": "Quiet celebration in Yorkville. The good kind.",
    },
    "midtown": {
        "excitement": "Eglinton is buzzing. Commuters are walking slower, actually looking around.",
        "tension": "Midtown professionals in full stress-mode. Very fast walking.",
        "frustration": "Nobody's going out tonight. Midtown is staying in.",
        "pride": "The neighbourhood feels good about itself right now.",
    },
    "kensington": {
        "excitement": "Market's alive in a way that even the regulars are looking up.",
        "tension": "Baldwin Street is quieter than usual. Something shifted.",
        "frustration": "The vibe on Augusta is off. People are feeling it.",
        "pride": "Kensington showing out in exactly the way Kensington knows how.",
    },
    "west_end": {
        "excitement": "Roncesvalles is packed. People stopped on the sidewalk just to take it in.",
        "tension": "Something in the west end air feels unsettled today.",
        "frustration": "Energy on Dundas West is low. People staying home.",
        "pride": "West End neighbourhoods doing exactly what makes them special.",
    },
    "little_portugal": {
        "excitement": "Ossington is alive. People who never talk are talking.",
        "tension": "The street's tight right now. Nobody's saying it but everyone feels it.",
        "frustration": "Tension on Dundas running through the whole block.",
        "pride": "Little Portugal knows how to come together. It's coming together.",
    },
    "little_italy": {
        "excitement": "College Street is absolutely going. Gio's windows are open all the way.",
        "tension": "The espresso is flowing but the mood at the tables is tense.",
        "frustration": "Nobody's lingering on the patios. That's unusual. That's a sign.",
        "pride": "College Street doing the thing it does best: being very much itself.",
    },
    "rosedale": {
        "excitement": "Even Rosedale is out tonight. That means something.",
        "tension": "A quiet tension behind closed doors. Still polite about it.",
        "frustration": "Rosedale in minor distress. Still composed. Very slightly.",
        "pride": "The neighbourhood is pleased. Very quietly pleased.",
    },
    "east_york": {
        "excitement": "Danforth is loud in the best way. Patrick's in his element.",
        "tension": "East York is tense. But East York handles tense differently than everyone else.",
        "frustration": "The community is frustrated. They have the right to be.",
        "pride": "This neighbourhood remembers everything and is proud of it.",
    },
    "north_york": {
        "excitement": "Yonge and Sheppard has an energy tonight. Unexpected and welcome.",
        "tension": "North York stress is the suburban kind. Contained but real.",
        "frustration": "Things not going great in North York right now. Numbers confirm it.",
        "pride": "The neighbourhood showing up for itself. Danny approves.",
    },
    "etobicoke": {
        "excitement": "Something got Etobicoke going tonight. Even Kevin's outside.",
        "tension": "Etobicoke is on edge. The gruff kind. Still polite.",
        "frustration": "Community is frustrated. Vince has already explained why three times.",
        "pride": "Humber neighbourhoods are showing pride today. Earned.",
    },
    "scarborough": {
        "excitement": "Scarborough is LOUD tonight. Amir's posting. Grace is at the community centre. Marcus is trying not to care.",
        "tension": "Something's building in Scarborough. Grace is organising. Amir is documenting.",
        "frustration": "The community is saying it clearly: we deserve better. And they're right.",
        "pride": "Scarborough showing why it doesn't need to be anything other than itself.",
    },
}

_CITIZEN_ACTIVITY_POOLS: dict[str, list[str]] = {
    "Amir":      ["Outside documenting EVERYTHING 🔥", "This block is going OFF and Amir will not be quiet about it.", "Posted seven times in the last hour. Zero regrets.", "BRO 👀 BRO.", "The neighbourhood is alive and Amir is LOUDLY present for it."],
    "Grace":     ["At the community centre making sure everyone's accounted for.", "Checking on neighbours. That's just what you do.", "Quietly making sure the right people know what's happening.", "The block needs steady hands right now. Grace has steady hands.", "Organising support. Not waiting for anyone to ask."],
    "Marcus":    ["Watching from the window. Reluctantly.", "Fine. I care. I said it.", "Monitoring the situation from the couch.", "Didn't ask to be invested in this. Here we are.", "Dry commentary only. But Marcus is paying attention."],
    "Danny":     ["OUTSIDE IN THE DRIVEWAY. THIS IS THE GREATEST NEIGHBOURHOOD.", "Texted the block group chat. Everyone is now informed.", "Vibrating with dad energy right now.", "TOLD EVERYONE. THEY KNOW.", "This is the best block on the planet and Danny will not stop saying it."],
    "Mei":       ["Watching the vibe carefully before committing to an opinion.", "Something feels different today. Mei is processing.", "Cautiously optimistic. Reading signs.", "Checking in with a few neighbours to get the real read.", "The energy is there. Mei is choosing to believe in it."],
    "Raj":       ["Actually, the data on this is very clear.", "Sent a four-paragraph analysis to the group chat. Unasked for. Accurate.", "If you look at the numbers, this outcome was predictable.", "Raj is explaining something to someone who didn't ask.", "Statistical inevitability. Raj is not surprised."],
    "Kevin":     ["Seen worse. Seen better. Still watching.", "Back in the day, this would've been handled differently.", "Kevin is grumbling, but he's not going inside.", "Compared this to 1987. Kevin always compares things to 1987.", "Not impressed. Not leaving."],
    "Sandra":    ["Surprised by how much she cares about this.", "Sandra did not expect to have this many feelings today.", "Started watching five minutes ago. Now fully invested.", "This was not part of Sandra's evening plan. Here she is anyway.", "Genuinely didn't care three hours ago. Cannot look away now."],
    "Vince":     ["Vince has a strong opinion. Vince is confident. Vince is Vince.", "Strong opinion. As always.", "Vince will tell anyone who'll listen what this all means.", "Called it two weeks ago. Vince says. Nobody can verify.", "Full confidence. Debatable accuracy. Total commitment."],
    "Jordan":    ["Posting from King and Bay. Something is happening.", "Did not plan to be outside. The city had other plans.", "Live update: the streets are talking and Jordan is recording.", "Extremely online even while physically outside.", "Just here, absorbing. And posting about it."],
    "Priya":     ["Running the numbers. The data says something interesting.", "Citing statistics mid-conversation about city vibes.", "Analysis mode: active. Processing.", "Cross-referencing this with the last three comparable situations.", "The metrics on this are actually really telling."],
    "Tyler":     ["THE ENERGY IS UNREAL. TYLER IS OUTSIDE.", "Chest out. Tyler is present.", "Someone had to be here and it was going to be Tyler.", "Tyler is very confident about what this all means.", "Loud, present, and absolutely not going home."],
    "William":   ["William sent a three-word response. Unusually enthusiastic.", "Politely present. Quietly invested.", "William is attending. Discreetly.", "A subtle nod from William. High praise.", "William has opinions. Choosing not to share all of them."],
    "Catherine": ["Catherine has watched this city for forty years. She's watching now.", "Measured response. Decades of context.", "Diplomatically noting that this is significant.", "Catherine remembers when. She's here for now too.", "Composed. But paying very close attention."],
    "Theo":      ["Suspicious of the mainstream response, personally.", "Watching from a critical distance.", "Theo has questions about what this actually means.", "Counter-narrative mode: engaged.", "Didn't want to care about this. Still kind of does."],
    "Luna":      ["Found a way to connect this to broader systems. As expected.", "Luna is writing something. It will be very passionate.", "This connects to everything Luna has been saying.", "Gentrification angle: identified. Luna is on it.", "Three paragraphs in the group chat. Luna is not done."],
    "Sofia":     ["Got the neighbours together. That's what you do.", "Found the middle ground and stood there firmly.", "Warm and present. The block feels it.", "Already organising. Sofia doesn't wait.", "Making sure everyone's included. Classic."],
    "Diogo":     ["Going where the energy is. The energy is good tonight.", "Found the vibe. Now in the vibe.", "Laid back. Following the flow.", "Wherever things are happening, Diogo ends up there.", "Easy-going. Very much here."],
    "Ana":       ["Trying to stay neutral. Failing.", "Ana is stressed but is trying not to show it. It shows.", "The group chat is wild. Ana is watching.", "Officially overwhelmed. Unofficially fine.", "Neutral. Definitely neutral. Completely neutral."],
    "Marco":     ["Marco has a proverb for this. He's sharing it.", "Espresso cold. Opinions hot. Marco is engaged.", "Speaking with his hands about the current situation.", "Marco knows what this means. He will explain it thoroughly.", "Loud, correct, and very animated about it."],
    "Rosa":      ["Already knew. Rosa always already knows.", "The gossip network is active. Rosa is the centre.", "Heard about this before it happened. Typical.", "Running the block information channel as always.", "Nothing happens on this street without Rosa knowing first."],
    "Gio":       ["The café is somehow the loudest place on the block.", "Gio is doing commentary. From the café. Loudly.", "Running a one-man broadcast from behind the counter.", "Windows open. Coffee flowing. Gio has thoughts.", "Gio's voice can be heard from a block away. Happily."],
    "Arthur":    ["Arthur is observing. Thoughtfully.", "Present. Measured. Quietly invested.", "Arthur sent one message. It said a lot.", "Not one to overreact. Paying attention.", "The quiet type who actually understands everything."],
    "Helen":     ["Helen has seen this before. And the time before that.", "Opening a good bottle for this one.", "Decades of context. Watching calmly.", "Remembers a similar evening in 1994. Things worked out.", "The garden is a good place to watch the city from."],
    "Patrick":   ["EAST YORK. THIS IS OUR CITY. PATRICK IS SAYING IT.", "Patrick is not calm. Patrick is proud. Loudly.", "Fully invested. Has been for forty years.", "This city belongs to East York and Patrick says so constantly.", "TFC energy activated. Patrick is 100% here."],
    "Donna":     ["TEXTED THE WHOLE NEIGHBOURHOOD. CAPS LOCK ON.", "Donna sent a text chain so long the phone needed to scroll.", "ALL CAPS. ALL HEART. DONNA IS INVOLVED.", "Neighbourhood updates distributed. Donna is on it.", "Checked in with everyone she knows. That's a lot of people."],
    "Terry":     ["Been here forty years. Seen this before. Still watching.", "Terry's walking the block. That's Terry's move.", "Old East Ender staying steady.", "Not panicking. Never panics. Just watching.", "This city's been through a lot. Terry was there for most of it."],
    "Jasmine":   ["Came for the neighbourhood. Stayed for exactly this.", "West End energy has fully converted her. She's all in.", "Still surprised by how much she cares. Very much cares.", "Called her mom. Said 'I love where I live.'", "Didn't expect to feel this way about this block. Here she is."],
    "Noah":      ["Called it. Noah always calls it.", "Already knew. Didn't say anything. Now saying something.", "Ironic post drafted. Also genuinely interested.", "Posted something that sounds detached. Is not detached.", "Was watching before anyone else started watching."],
    "Vivek":     ["Found the market angle in this. Immediately.", "This has implications for Q3. Running the numbers.", "Tied this to something macroeconomic. As expected.", "Finance brain activated. Everything is a spreadsheet.", "Interesting from a portfolio perspective, actually."],
    "Claire":    ["Texted her sister. Again.", "The sister text chain is going. Providing updates.", "Running colour commentary on everything happening.", "Her sister has now been looped in on all developments.", "Fully informed. Fully in the loop. Fully texting."],
    "Sam":       ["Equal amounts excited and anxious. Sam's natural state.", "Is it good? Is it fine? Sam is both.", "Vibing and stressing simultaneously. Very relatable.", "Everything is fine and also a lot is happening.", "Sam is present. And very much feeling all of it."],
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
    templates = _DISTRICT_ARCHETYPES.get(district_state.district_id, {})
    dominant = district_state.dominant
    return templates.get(dominant, f"People in {district_state.district_id.replace('_', ' ').title()} are moving through the city in their own rhythm.")


async def generate_citizen_activity(
    *,
    citizen_name: str,
    voice: str,
    district_id: str,
    archetype: str,
    memories: list[str],
    last_event_type: str | None,
) -> str:
    import random
    pool = _CITIZEN_ACTIVITY_POOLS.get(citizen_name)
    if pool:
        return random.choice(pool)
    return f"{citizen_name} is keeping up with what's happening in the city."


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
    """Return (ambient_text, character_name) from hardcoded pool — zero AI latency."""
    import random
    char = pick_character(state.district_id)
    dominant = state.dominant
    # Prefer character-specific pool; fall back to mood pool
    pool = _CITIZEN_ACTIVITY_POOLS.get(char["name"])
    if pool:
        return random.choice(pool), char["name"]
    options = _AMBIENT_FALLBACKS.get(dominant, [f"The vibe in this neighbourhood is {dominant} right now."])
    return random.choice(options), char["name"]

