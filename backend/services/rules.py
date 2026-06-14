# Deterministic delta rules and decay math — implemented in Task 1.5

import logging
import math

from backend.models.district import DistrictState
from backend.models.event import MatchEvent
from backend.services.scenario import ScenarioConfig

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

DECAY_FACTOR: float = 0.9
BASELINE: float = 50.0

EVENT_SOURCE: dict[str, str] = {
    "transit_strike":   "downtown",
    "heat_wave":        "downtown",
    "festival":         "downtown",
    "power_outage":     "downtown",
    "major_layoffs":    "downtown",
    "cultural_event":   "downtown",
    "protest":          "downtown",
    "street_fair":      "kensington",
    "goal":             "downtown",   # BMO Field / downtown core
    "red_card":         "downtown",
    "var_review":       "downtown",
    "penalty_miss":     "downtown",
    "elimination":      "downtown",
    "championship_win": "downtown",
}

CITY_EVENT_DELTAS: dict[str, dict[str, float]] = {
    "transit_strike":   {"tension": 22.0, "frustration": 12.0, "social": -8.0, "mobility": -25.0},
    "heat_wave":        {"tension": 18.0, "frustration": 10.0, "social": -4.0, "mobility": -10.0},
    "festival":         {"excitement": 18.0, "pride": 8.0, "social": 15.0},
    "power_outage":     {"tension": 20.0, "frustration": 8.0, "social": 10.0},
    "major_layoffs":    {"frustration": 25.0, "tension": 14.0, "social": -6.0},
    "cultural_event":   {"pride": 16.0, "excitement": 8.0, "social": 6.0},
    "protest":          {"tension": 20.0, "excitement": 6.0, "social": 8.0},
    "street_fair":      {"excitement": 12.0, "social": 16.0, "pride": 4.0},
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

    Deltas are scaled by event severity [0, 1].
    All fields are clamped to [0, 100] after all deltas are applied.
    """
    # Custom effects from NL organic events bypass hardcoded rules
    custom_effects = getattr(event, "custom_effects", None)
    if event.type == "organic" and custom_effects:
        district_effects = custom_effects.get(state.district_id)
        if district_effects:
            for emotion, delta in district_effects.items():
                current = getattr(state.emotion, emotion, 50.0)
                setattr(state.emotion, emotion, current + delta * event.severity)
        _clamp_state(state)
        return

    s = event.severity

    if event.type in CITY_EVENT_DELTAS:
        deltas = CITY_EVENT_DELTAS[event.type]
        for key, delta in deltas.items():
            if key in {"social", "mobility"}:
                current = getattr(state.activity, key)
                setattr(state.activity, key, current + delta * s)
            else:
                current = getattr(state.emotion, key)
                setattr(state.emotion, key, current + delta * s)
        _clamp_state(state)
        return

    ORGANIC_DELTAS = {
        "street_party":          {"excitement": 8.0,  "pride": 5.0,  "social": 10.0},
        "city_buzz":             {"excitement": 5.0,  "social": 6.0},
        "neighbourhood_chatter": {"social": 8.0,      "tension": -3.0},
        "street_party_forming":  {"excitement": 15.0, "social": 10.0, "pride": 8.0},
        "community_gathering":   {"pride": 6.0,       "social": 10.0, "excitement": 4.0},
        "local_incident":        {"tension": 8.0,     "frustration": 5.0},
    }

    if event.type in ORGANIC_DELTAS:
        deltas = ORGANIC_DELTAS[event.type]
        factor = max(0.0, 1.0 - 0.15 * distance_rank) * s
        for key, delta in deltas.items():
            if key == "social":
                state.activity.social += delta * factor
            else:
                current = getattr(state.emotion, key)
                setattr(state.emotion, key, current + delta * factor)
    else:
        logger.warning("Unhandled event type '%s'; no delta applied.", event.type)

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
