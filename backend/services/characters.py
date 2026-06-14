import random

DISTRICT_CHARACTERS: dict[str, list[dict]] = {
    "scarborough": [
        {"id": "amir",    "name": "Amir",    "emoji": "🧑🏿",    "align": 0.90, "voice": "loud, passionate, emojis everywhere, screams in text"},
        {"id": "grace",   "name": "Grace",   "emoji": "👩🏽",    "align": 0.82, "voice": "community-minded, measured, deeply proud of Scarborough"},
        {"id": "marcus",  "name": "Marcus",  "emoji": "🧔🏾",   "align": 0.75, "voice": "dry humor, sarcastic, reluctantly invested in everything"},
    ],
    "north_york": [
        {"id": "hassan",  "name": "Hassan",  "emoji": "🧑🏾",    "align": 0.80, "voice": "excitable family energy, all-caps texts, watches with relatives"},
        {"id": "mei",     "name": "Mei",     "emoji": "👩🏻",    "align": 0.72, "voice": "cautiously optimistic, livestreaming, always reading the vibe"},
        {"id": "raj",     "name": "Raj",     "emoji": "🧑🏽",    "align": 0.76, "voice": "cricket fan who got into soccer last year, explains city statistics"},
    ],
    "etobicoke": [
        {"id": "donna",   "name": "Donna",   "emoji": "👩🏼‍🦳",  "align": 0.74, "voice": "neighbourhood watch energy, proud Canadian, compares to how it used to be"},
        {"id": "kevin",   "name": "Kevin",   "emoji": "🧑🏼",    "align": 0.70, "voice": "old-school local, sports bar regular, very loud"},
        {"id": "tanya",   "name": "Tanya",   "emoji": "👩🏽",    "align": 0.68, "voice": "surprised by how much she cares, casually invested"},
    ],
    "downtown": [
        {"id": "jordan",  "name": "Jordan",  "emoji": "🧑🏽",    "align": 0.58, "voice": "chronically online, extremely online reactions, very meme"},
        {"id": "priya",   "name": "Priya",   "emoji": "👩🏽‍💼", "align": 0.62, "voice": "analytical, cites statistics mid-conversation, data-first"},
        {"id": "kai",     "name": "Kai",     "emoji": "🧑🏽‍🎨", "align": 0.55, "voice": "artist, makes everything aesthetic, big energy"},
    ],
    "yorkville": [
        {"id": "james",   "name": "James",   "emoji": "🧑🏼‍💼", "align": 0.44, "voice": "more interested in the champagne than the match, polite and detached"},
        {"id": "elise",   "name": "Elise",   "emoji": "👩🏼‍💼", "align": 0.46, "voice": "diplomatically opinionated, watched in a private club"},
        {"id": "richard", "name": "Richard", "emoji": "👴🏼",    "align": 0.42, "voice": "claims to be above sports but keeps checking the score, golf clap energy"},
    ],
    "kensington": [
        {"id": "theo",    "name": "Theo",    "emoji": "🧑🏻‍🦱", "align": 0.55, "voice": "counterculture, suspicious of mainstream excitement, still watching"},
        {"id": "luna",    "name": "Luna",    "emoji": "👩🏻‍🦰", "align": 0.60, "voice": "found a way to tie this to gentrification, passionate"},
        {"id": "sam_k",   "name": "Sam",     "emoji": "🧑🏼",    "align": 0.58, "voice": "vintage store owner, cautiously optimistic, ironic takes"},
    ],
    "little_portugal": [
        {"id": "sofia",   "name": "Sofia",   "emoji": "👩🏻",    "align": 0.50, "voice": "warm and community-minded, split loyalties, conflicted"},
        {"id": "diogo",   "name": "Diogo",   "emoji": "🧑🏻",    "align": 0.25, "voice": "Portugal mode, apologetic about Canada, laid-back"},
        {"id": "ana",     "name": "Ana",     "emoji": "👩🏻‍🦱", "align": 0.55, "voice": "practical, loves both teams, trying to stay neutral"},
    ],
    "little_italy": [
        {"id": "marco",   "name": "Marco",   "emoji": "🧑🏻",    "align": 0.55, "voice": "Italy fan first, Canada fan second, speaks in proverbs"},
        {"id": "giulia",  "name": "Giulia",  "emoji": "👩🏻",    "align": 0.60, "voice": "makes everything about food, strong opinions, very animated"},
        {"id": "franco",  "name": "Franco",  "emoji": "👴🏻",    "align": 0.50, "voice": "has seen too many heartbreaks to get excited, café commentary"},
    ],
    "rosedale": [
        {"id": "william", "name": "William", "emoji": "👴🏼",    "align": 0.45, "voice": "measured, quietly invested, understated reactions, polite"},
        {"id": "catherine", "name": "Catherine", "emoji": "👩🏼", "align": 0.50, "voice": "diplomatically opinionated, world traveler, has lived in the city for decades"},
        {"id": "oliver",  "name": "Oliver",  "emoji": "🧑🏼",    "align": 0.48, "voice": "vaguely watching from a rooftop patio, champagne-adjacent"},
    ],
    "east_york": [
        {"id": "denise",  "name": "Denise",  "emoji": "👩🏾",    "align": 0.72, "voice": "lifelong Toronto fan, very online, passionate and loyal"},
        {"id": "pat",     "name": "Pat",     "emoji": "🧑🏼",    "align": 0.68, "voice": "pub quiz regular, knows all the stats, proud of East York"},
        {"id": "zeynep",  "name": "Zeynep",  "emoji": "👩🏽",    "align": 0.74, "voice": "calls Canada goals before they happen, very online"},
    ],
    "west_end": [
        {"id": "nadia",   "name": "Nadia",   "emoji": "👩🏽",    "align": 0.66, "voice": "cyclist, progressive, quietly patriotic, surprised herself"},
        {"id": "felix",   "name": "Felix",   "emoji": "🧑🏻",    "align": 0.62, "voice": "works in tech, watching on second monitor, ironic but invested"},
        {"id": "bea",     "name": "Bea",     "emoji": "👩🏼‍🦱", "align": 0.64, "voice": "artist-run gallery owner, ambivalent then ecstatic"},
    ],
    "midtown": [
        {"id": "claire",  "name": "Claire",  "emoji": "👩🏼",    "align": 0.60, "voice": "young professional, Raptors crossover fan, running commentary"},
        {"id": "andrew",  "name": "Andrew",  "emoji": "🧑🏼",    "align": 0.56, "voice": "finance bro who showed up for the vibe, big energy"},
        {"id": "diana",   "name": "Diana",   "emoji": "👩🏻‍🦳", "align": 0.58, "voice": "teacher, keeps it calm, very proud"},
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
