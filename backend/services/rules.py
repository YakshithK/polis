# Deterministic delta rules — ActiveEffect-based system

import logging
import math

from backend.models.district import ActiveEffect, DistrictState
from backend.models.event import MatchEvent
from backend.services.scenario import ScenarioConfig

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DECAY_FACTOR: float = 0.975
BASELINE: float = 50.0
CITY_EVENT_BOOST: float = 3.2
CITY_EVENT_MIN_FACTOR: float = 0.35
CITY_EVENT_DISTANCE_STEP: float = 0.08

EVENT_SOURCE: dict[str, str] = {
    "transit_strike":   "downtown",
    "heat_wave":        "downtown",
    "festival":         "downtown",
    "power_outage":     "downtown",
    "major_layoffs":    "downtown",
    "cultural_event":   "downtown",
    "protest":          "downtown",
    "street_fair":      "kensington",
    "goal":             "downtown",
    "red_card":         "downtown",
    "var_review":       "downtown",
    "penalty_miss":     "downtown",
    "elimination":      "downtown",
    "championship_win": "downtown",
}

EFFECT_DURATIONS: dict[str, int] = {
    "goal":             120,
    "red_card":          45,
    "var_review":        20,
    "penalty_miss":      60,
    "championship_win": 480,
    "elimination":      360,
    "heat_wave":        300,
    "pandemic":        1440,
    "power_outage":     180,
    "street_party":     150,
    "festival":         480,
    "traffic_jam":       90,
    "storm":            200,
    "transit_strike":   200,
    "major_layoffs":    360,
    "cultural_event":   120,
    "protest":          180,
    "street_fair":      120,
    "organic":          120,
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

MATCH_EVENT_DELTAS: dict[str, dict[str, float]] = {
    "goal":             {"excitement": 35.0, "pride": 20.0},
    "red_card":         {"tension": 28.0, "frustration": 18.0},
    "var_review":       {"tension": 20.0, "frustration": 12.0},
    "penalty_miss":     {"frustration": 28.0, "tension": 12.0},
    "championship_win": {"excitement": 50.0, "pride": 45.0},
    "elimination":      {"frustration": 38.0, "tension": 18.0},
}

ORGANIC_DELTAS: dict[str, dict[str, float]] = {
    "street_party":          {"excitement": 8.0,  "pride": 5.0,  "social": 10.0},
    "city_buzz":             {"excitement": 5.0,  "social": 6.0},
    "neighbourhood_chatter": {"social": 8.0,      "tension": -3.0},
    "street_party_forming":  {"excitement": 15.0, "pride": 8.0,  "social": 10.0},
    "community_gathering":   {"pride": 6.0,       "social": 10.0, "excitement": 4.0},
    "local_incident":        {"tension": 8.0,     "frustration": 5.0},
}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_influence(
    event: MatchEvent,
    states: list[DistrictState],
    scenario: ScenarioConfig,
) -> list[tuple[DistrictState, int]]:
    """Return districts sorted by Euclidean distance from event source district."""
    source_district = getattr(event, "source_district", None) or EVENT_SOURCE.get(event.type, "downtown")
    source_coords = scenario.district_centroids.get(source_district)

    if source_coords is None:
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


def apply_event(state: DistrictState, event: MatchEvent, distance_rank: int = 0, impact_scale: float = 1.0) -> None:
    """Add an ActiveEffect for emotion changes. Directly apply activity changes."""
    s = event.severity
    emotion_deltas: dict[str, float] = {}
    activity_deltas: dict[str, float] = {}

    custom_effects = getattr(event, "custom_effects", None)
    if event.type == "organic" and custom_effects:
        district_effects = custom_effects.get(state.district_id)
        if district_effects:
            for key, delta in district_effects.items():
                scaled = delta * s * impact_scale
                if key in {"social", "mobility"}:
                    activity_deltas[key] = scaled
                else:
                    emotion_deltas[key] = scaled

    elif event.type in CITY_EVENT_DELTAS:
        deltas = CITY_EVENT_DELTAS[event.type]
        source_boost = 1.7 if distance_rank == 0 else 1.0
        distance_factor = max(CITY_EVENT_MIN_FACTOR, 1.0 - CITY_EVENT_DISTANCE_STEP * distance_rank)
        factor = s * CITY_EVENT_BOOST * source_boost * distance_factor * impact_scale
        for key, delta in deltas.items():
            if key in {"social", "mobility"}:
                activity_deltas[key] = delta * factor
            else:
                emotion_deltas[key] = delta * factor

    elif event.type in MATCH_EVENT_DELTAS:
        deltas = MATCH_EVENT_DELTAS[event.type]
        is_canada_goal = (event.type == "goal" and (event.team is None or event.team.lower() == "canada"))
        source_boost = 1.7 if (distance_rank == 0 or is_canada_goal) else 1.0
        distance_factor = 1.0 if is_canada_goal else max(CITY_EVENT_MIN_FACTOR, 1.0 - CITY_EVENT_DISTANCE_STEP * distance_rank)
        factor = s * CITY_EVENT_BOOST * source_boost * distance_factor * impact_scale
        if is_canada_goal:
            factor = max(factor, 4.0)
        for key, delta in deltas.items():
            emotion_deltas[key] = delta * factor

    elif event.type in ORGANIC_DELTAS:
        deltas = ORGANIC_DELTAS[event.type]
        factor = max(0.35, 1.0 - 0.10 * distance_rank) * s * 1.5
        for key, delta in deltas.items():
            if key in {"social", "mobility"}:
                activity_deltas[key] = delta * factor
            else:
                emotion_deltas[key] = delta * factor

    else:
        logger.warning("Unhandled event type '%s'; no delta applied.", event.type)

    # Create ActiveEffect for emotion deltas
    if emotion_deltas:
        duration = getattr(event, "duration", None) or EFFECT_DURATIONS.get(event.type, 120)
        effect = ActiveEffect(
            event_type=event.type,
            team=event.team,
            start_minute=event.minute,
            duration_minutes=duration,
            peak_deltas=emotion_deltas,
        )
        state.active_effects.append(effect)
        state.prune_expired(event.minute)

    # Apply activity deltas directly (not time-decayed)
    for key, delta in activity_deltas.items():
        if key == "social":
            state.activity.social = max(0.0, min(100.0, state.activity.social + delta))
        elif key == "mobility":
            state.activity.mobility = max(0.0, min(100.0, state.activity.mobility + delta))


def decay_state(state: DistrictState) -> None:
    """Apply exponential decay on activity fields only. Emotions are now driven by ActiveEffect."""
    a = state.activity
    a.social   = a.social   * DECAY_FACTOR + BASELINE * (1 - DECAY_FACTOR)
    a.mobility = a.mobility * DECAY_FACTOR + BASELINE * (1 - DECAY_FACTOR)


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
    a.social   = max(0.0, min(100.0, a.social))
    a.mobility = max(0.0, min(100.0, a.mobility))
