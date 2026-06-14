import random

DISTRICT_CHARACTERS: dict[str, list[dict]] = {
    "scarborough": [
        {"name": "Amir",   "voice": "loud, passionate, emojis everywhere, screams in text"},
        {"name": "Grace",  "voice": "community-minded, measured, deeply proud of Scarborough"},
        {"name": "Marcus", "voice": "dry humor, sarcastic, reluctantly invested in everything"},
    ],
    "north_york": [
        {"name": "Danny",  "voice": "excitable dad energy, all-caps texts, thinks this block is the best block"},
        {"name": "Mei",    "voice": "cautiously optimistic, superstitious, always reading the vibe"},
        {"name": "Raj",    "voice": "explains city statistics to people who didn't ask, very analytical"},
    ],
    "etobicoke": [
        {"name": "Kevin",  "voice": "old-school local, compares everything to how it used to be, gruff"},
        {"name": "Sandra", "voice": "casual observer who got really invested in city happenings, surprised herself"},
        {"name": "Vince",  "voice": "has strong opinions on everything, extremely confident, often wrong"},
    ],
    "downtown": [
        {"name": "Jordan", "voice": "chronically online, extremely online reactions, very meme"},
        {"name": "Priya",  "voice": "analytical, cites statistics mid-conversation, data-first"},
        {"name": "Tyler",  "voice": "big energy, overly confident, talks with his chest"},
    ],
    "yorkville": [
        {"name": "William",   "voice": "polite, detached, golf clap energy, champagne-adjacent"},
        {"name": "Catherine", "voice": "diplomatically opinionated, has seen this city change over decades, very composed"},
    ],
    "kensington": [
        {"name": "Theo", "voice": "counterculture, suspicious of mainstream excitement, still watching"},
        {"name": "Luna", "voice": "found a way to tie this to gentrification, passionate"},
    ],
    "little_portugal": [
        {"name": "Sofia",  "voice": "warm and community-minded, always finding the middle ground"},
        {"name": "Diogo",  "voice": "laid-back, easy-going, goes wherever the energy is"},
        {"name": "Ana",    "voice": "stressed, trying to stay neutral, failing"},
    ],
    "little_italy": [
        {"name": "Marco", "voice": "speaks in proverbs, strong opinions, very animated"},
        {"name": "Rosa",  "voice": "runs the neighbourhood gossip network, knows everyone's business"},
        {"name": "Gio",   "voice": "running café commentary, loudest person in the room"},
    ],
    "rosedale": [
        {"name": "Arthur", "voice": "measured, quietly invested, understated reactions"},
        {"name": "Helen",  "voice": "has lived in the city for decades, full of anecdotes, drinks wine"},
    ],
    "east_york": [
        {"name": "Patrick", "voice": "TFC lifer, passionately loyal to East York, fiercely local"},
        {"name": "Donna",   "voice": "mom energy, all uppercase texts, extremely into neighbourhood news"},
        {"name": "Terry",   "voice": "old East Ender, been here 40 years, proud of this city"},
    ],
    "west_end": [
        {"name": "Jasmine", "voice": "came for the vibe, now actually invested in the neighbourhood, surprised"},
        {"name": "Noah",    "voice": "posts ironic takes, somehow always knows what's happening before anyone else"},
    ],
    "midtown": [
        {"name": "Vivek",  "voice": "works in finance, somehow ties city events to markets, intense"},
        {"name": "Claire", "voice": "running commentary on everything, texts her sister every 2 minutes"},
        {"name": "Sam",    "voice": "equal amounts excited and anxious, very relatable"},
    ],
}


def pick_character(district_id: str) -> dict:
    chars = DISTRICT_CHARACTERS.get(district_id, [{"name": "A local", "voice": "enthusiastic"}])
    return random.choice(chars)


def get_characters_for_district(district_id: str) -> list[dict]:
    return list(DISTRICT_CHARACTERS.get(district_id, [{"name": "A local", "voice": "enthusiastic"}]))


def iter_characters() -> list[dict]:
    roster: list[dict] = []
    for district_id, characters in DISTRICT_CHARACTERS.items():
        for character in characters:
            roster.append({"district_id": district_id, **character})
    return roster


def trim_voice(voice: str, max_sentences: int = 2) -> str:
    parts = [part.strip() for part in voice.replace("!", ".").replace("?", ".").split(".") if part.strip()]
    return ". ".join(parts[:max_sentences])
