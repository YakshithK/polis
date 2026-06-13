# Deterministic delta rules and decay math — implemented in Task 1.5

import math

from backend.models.district import DistrictState
from backend.models.event import MatchEvent
from backend.services.scenario import ScenarioConfig

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

DECAY_FACTOR: float = 0.9
BASELINE: float = 50.0

EVENT_SOURCE: dict[str, str] = {
    "goal":             "downtown",   # BMO Field / downtown core
    "red_card":         "downtown",
    "var_review":       "downtown",
    "penalty_miss":     "downtown",
    "elimination":      "downtown",
    "championship_win": "downtown",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_influence(
    event: MatchEvent,
    states: list[DistrictState],
    scenario: ScenarioConfig,
) -> list[tuple[DistrictState, int]]:
    """Return districts sorted by Euclidean distance from event source district.

    Each district is tagged with a distance_rank (0 = closest/origin district,
    increasing outward).  All districts are included — no cutoff.
    """
    source_district = getattr(event, "source_district", None) or EVENT_SOURCE.get(event.type, "downtown")
    source_coords = scenario.district_centroids.get(source_district)

    if source_coords is None:
        # Fallback: return all districts with rank 0
        return [(s, 0) for s in states]

    def distance(district_id: str) -> float:
        coords = scenario.district_centroids.get(district_id)
        if coords is None:
            return float("inf")
        return math.sqrt(
            (coords[0] - source_coords[0]) ** 2 + (coords[1] - source_coords[1]) ** 2
        )

    sorted_states = sorted(states, key=lambda s: distance(s.district_id))
    return [(s, rank) for rank, s in enumerate(sorted_states)]


def apply_event(state: DistrictState, event: MatchEvent, distance_rank: int = 0) -> None:
    """Apply deterministic delta rules to a district state in-place.

    Deltas are weighted by district alignment fractions (canada_support /
    opponent_support as fractions of 100) and scaled by event severity [0, 1].
    All fields are clamped to [0, 100] after all deltas are applied.
    """
    s = event.severity                          # severity multiplier [0.0, 1.0]
    ca = state.alignment.canada_support / 100.0
    op = state.alignment.opponent_support / 100.0

    ORGANIC_DELTAS = {
        "street_party":          {"excitement": 8.0,  "pride": 5.0,  "social": 10.0},
        "pub_crowd":             {"excitement": 6.0,  "social": 12.0, "tension": 3.0},
        "fan_gathering":         {"excitement": 10.0, "social": 8.0},
        "city_buzz":             {"excitement": 5.0,  "social": 6.0},
        "neighbourhood_chatter": {"social": 8.0,      "tension": -3.0},
        "fan_fight":             {"tension": 12.0,    "social": 5.0,   "excitement": -2.0},
        "street_party_forming":  {"excitement": 15.0, "social": 10.0, "pride": 8.0},
    }

    if event.type in ORGANIC_DELTAS:
        deltas = ORGANIC_DELTAS[event.type]
        factor = max(0.0, 1.0 - 0.15 * distance_rank) * s
        if "excitement" in deltas:
            state.emotion.excitement += deltas["excitement"] * factor
        if "tension" in deltas:
            state.emotion.tension += deltas["tension"] * factor
        if "frustration" in deltas:
            state.emotion.frustration += deltas["frustration"] * factor
        if "pride" in deltas:
            state.emotion.pride += deltas["pride"] * factor
        if "social" in deltas:
            state.activity.social += deltas["social"] * factor

    elif event.type == "goal" and event.team == "canada":
        state.emotion.excitement  += 30 * ca * s
        state.emotion.pride       += 20 * ca * s
        state.activity.social     += 15 * s
        state.emotion.frustration += 10 * op * s

    elif event.type == "goal" and event.team == "opponent":
        state.emotion.excitement  += 30 * op * s
        state.emotion.pride       += 20 * op * s
        state.activity.social     += 15 * s
        state.emotion.frustration += 10 * ca * s

    elif event.type == "red_card" and event.team == "canada":
        state.emotion.tension     += 25 * ca * s
        state.emotion.frustration += 20 * ca * s

    elif event.type == "red_card" and event.team == "opponent":
        state.emotion.excitement  += 15 * ca * s
        state.emotion.tension     += 10 * op * s

    elif event.type == "var_review":
        state.emotion.tension     += 15 * s
        state.activity.social     += 10 * s

    elif event.type == "penalty_miss" and event.team == "canada":
        state.emotion.frustration += 25 * ca * s
        state.emotion.tension     += 15 * ca * s

    elif event.type == "penalty_miss" and event.team == "opponent":
        state.emotion.excitement  += 15 * ca * s

    elif event.type == "elimination" and event.team == "canada":
        state.emotion.excitement  -= 40 * ca * s
        state.emotion.frustration += 35 * ca * s
        state.activity.social     += 20 * s   # grief-posting

    elif event.type == "championship_win" and event.team == "canada":
        state.emotion.excitement  += 50 * ca * s
        state.emotion.pride       += 40 * ca * s
        state.activity.social     += 30 * s

    elif event.type == "elimination" and event.team == "opponent":
        # Opponent is eliminated — Canada supporters celebrate
        state.emotion.excitement += 40 * ca * s
        state.emotion.pride      += 25 * ca * s
        state.activity.social    += 20 * s

    elif event.type == "championship_win" and event.team == "opponent":
        # Opponent wins — Canada supporters are devastated
        state.emotion.frustration += 45 * ca * s
        state.emotion.excitement  -= 30 * ca * s
        state.activity.social     += 15 * s  # grief-posting

    # Clamp all fields to [0, 100] after applying deltas
    _clamp_state(state)


def decay_state(state: DistrictState) -> None:
    """Apply exponential decay toward baseline: value = value * 0.9 + 50.0 * 0.1

    Each tick nudges every emotion/activity field 10 % of the way back toward
    the neutral baseline of 50, regardless of whether it is above or below.
    """
    e = state.emotion
    e.excitement  = e.excitement  * DECAY_FACTOR + BASELINE * (1 - DECAY_FACTOR)
    e.tension     = e.tension     * DECAY_FACTOR + BASELINE * (1 - DECAY_FACTOR)
    e.frustration = e.frustration * DECAY_FACTOR + BASELINE * (1 - DECAY_FACTOR)
    e.pride       = e.pride       * DECAY_FACTOR + BASELINE * (1 - DECAY_FACTOR)
    a = state.activity
    a.social      = a.social   * DECAY_FACTOR + BASELINE * (1 - DECAY_FACTOR)
    a.mobility    = a.mobility * DECAY_FACTOR + BASELINE * (1 - DECAY_FACTOR)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _clamp_state(state: DistrictState) -> None:
    """Clamp all emotion and activity fields to [0, 100]."""
    e = state.emotion
    e.excitement  = max(0.0, min(100.0, e.excitement))
    e.tension     = max(0.0, min(100.0, e.tension))
    e.frustration = max(0.0, min(100.0, e.frustration))
    e.pride       = max(0.0, min(100.0, e.pride))
    a = state.activity
    a.social      = max(0.0, min(100.0, a.social))
    a.mobility    = max(0.0, min(100.0, a.mobility))
