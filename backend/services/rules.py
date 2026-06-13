# Deterministic delta rules and decay math — implemented in Task 1.5

from backend.models.district import DistrictState
from backend.models.event import MatchEvent
from backend.services.scenario import ScenarioConfig


def compute_influence(
    event: MatchEvent,
    states: list[DistrictState],
    scenario: ScenarioConfig,
) -> list[tuple[DistrictState, int]]:
    """Return districts sorted by distance from event source, each with a distance_rank.

    Stub: returns all districts with rank 0 until Task 1.5 implements real distance logic.
    """
    return [(s, 0) for s in states]


def apply_event(state: DistrictState, event: MatchEvent) -> None:
    """Apply deterministic delta rules to a district state in-place.

    Stub: no-op until Task 1.5 implements delta formulas.
    """
    pass


def decay_state(state: DistrictState) -> None:
    """Apply decay formula: state = state * 0.9 + baseline * 0.1

    Stub: no-op until Task 1.5 implements decay math.
    """
    pass
