import random

DISTRICT_CHARACTERS: dict[str, list[dict]] = {
    "scarborough": [
        {"name": "Amir",   "voice": "loud, passionate, emojis everywhere, screams in text"},
        {"name": "Grace",  "voice": "community-minded, measured, deeply proud"},
        {"name": "Marcus", "voice": "dry humor, sarcastic, reluctantly invested"},
    ],
    "north_york": [
        {"name": "Danny",  "voice": "excitable dad energy, all-caps moments, calls it 'soccer'"},
        {"name": "Mei",    "voice": "cautiously optimistic, superstitious, knocks on wood"},
        {"name": "Raj",    "voice": "explains VAR to people who didn't ask, very analytical"},
    ],
    "etobicoke": [
        {"name": "Kevin",  "voice": "old-school fan, compares everything to 2002, gruff"},
        {"name": "Sandra", "voice": "casual fan who got really into this, surprised herself"},
        {"name": "Vince",  "voice": "bets on everything, extremely confident, often wrong"},
    ],
    "downtown": [
        {"name": "Jordan", "voice": "chronically online, extremely online reactions, very meme"},
        {"name": "Priya",  "voice": "analytical, cites statistics mid-celebration, data-first"},
        {"name": "Tyler",  "voice": "sports bar energy, overly confident, talks with his chest"},
    ],
    "yorkville": [
        {"name": "William",   "voice": "polite, detached, golf clap energy, champagne-adjacent"},
        {"name": "Catherine", "voice": "diplomatically opinionated, has seen more World Cups than you"},
    ],
    "kensington": [
        {"name": "Theo", "voice": "counterculture, suspicious of mainstream excitement, still watching"},
        {"name": "Luna", "voice": "found a way to tie this to gentrification, passionate"},
    ],
    "little_portugal": [
        {"name": "Sofia",  "voice": "split loyalties, warm and conflicted, rooting for both somehow"},
        {"name": "Diogo",  "voice": "was in full Portugal mode, now lost, defaulting to vibes"},
        {"name": "Ana",    "voice": "stressed, trying to stay neutral, failing"},
    ],
    "little_italy": [
        {"name": "Marco", "voice": "speaks in proverbs, strong opinions, very animated"},
        {"name": "Rosa",  "voice": "Canada shirt, boyfriend in Bosnia colors, managing household diplomacy"},
        {"name": "Gio",   "voice": "running café commentary, loudest person in the room"},
    ],
    "rosedale": [
        {"name": "Arthur", "voice": "measured, quietly invested, understated reactions"},
        {"name": "Helen",  "voice": "watched 2002 in Europe, has anecdotes, drinks wine while watching"},
    ],
    "east_york": [
        {"name": "Patrick", "voice": "TFC lifer, transfers those feelings to Canada, passionate"},
        {"name": "Donna",   "voice": "mom energy, all uppercase texts, extremely into this"},
        {"name": "Terry",   "voice": "old East Ender, been here 40 years, proud of this city"},
    ],
    "west_end": [
        {"name": "Jasmine", "voice": "came for the vibe, now actually invested, surprised"},
        {"name": "Noah",    "voice": "posted 'it's coming home' ironically, now sincere about Canada"},
    ],
    "midtown": [
        {"name": "Vivek",  "voice": "works in finance, somehow ties this to markets, intense"},
        {"name": "Claire", "voice": "running commentary, texts her sister every 2 minutes"},
        {"name": "Sam",    "voice": "equal amounts excited and anxious, very relatable"},
    ],
}


def pick_character(district_id: str) -> dict:
    chars = DISTRICT_CHARACTERS.get(district_id, [{"name": "A local", "voice": "enthusiastic"}])
    return random.choice(chars)
