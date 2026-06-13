"""Unit tests for backend/services/rules.py — apply_event, decay_state, compute_influence."""

from __future__ import annotations

import pytest

from backend.models.district import (
    ActivityState,
    AlignmentState,
    DistrictState,
    EmotionState,
)
from backend.models.event import MatchEvent
from backend.services.rules import apply_event, compute_influence, decay_state
from backend.services.scenario import ScenarioConfig


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def make_district(
    district_id: str = "downtown",
    ca: float = 60.0,
    op: float = 20.0,
) -> DistrictState:
    return DistrictState(
        district_id=district_id,
        emotion=EmotionState(excitement=50.0, tension=50.0, frustration=50.0, pride=50.0),
        alignment=AlignmentState(canada_support=ca, opponent_support=op, neutral=100.0 - ca - op),
        activity=ActivityState(social=50.0, mobility=50.0),
        trend=0.0,
        recent_events=[],
    )


def make_goal_canada(severity: float = 1.0) -> MatchEvent:
    return MatchEvent(type="goal", team="canada", minute=10, severity=severity)


def make_goal_opponent(severity: float = 1.0) -> MatchEvent:
    return MatchEvent(type="goal", team="opponent", minute=10, severity=severity)


def make_red_card(team: str, severity: float = 1.0) -> MatchEvent:
    return MatchEvent(type="red_card", team=team, minute=30, severity=severity)


def make_var_review(severity: float = 1.0) -> MatchEvent:
    return MatchEvent(type="var_review", team="canada", minute=45, severity=severity)


def make_elimination(team: str, severity: float = 1.0) -> MatchEvent:
    return MatchEvent(type="elimination", team=team, minute=90, severity=severity)


def make_championship_win(team: str, severity: float = 1.0) -> MatchEvent:
    return MatchEvent(type="championship_win", team=team, minute=90, severity=severity)


# ---------------------------------------------------------------------------
# Tests for apply_event
# ---------------------------------------------------------------------------

def test_goal_canada_increases_excitement_proportional_to_alignment():
    """Excitement delta = 30 * (ca/100) * severity."""
    ca = 60.0
    severity = 0.8
    state = make_district(ca=ca, op=20.0)
    expected_excitement = 50.0 + 30 * (ca / 100) * severity
    apply_event(state, MatchEvent(type="goal", team="canada", minute=10, severity=severity))
    assert state.emotion.excitement == pytest.approx(expected_excitement, rel=1e-6)


def test_goal_canada_increases_pride():
    """Pride delta = 20 * (ca/100) * severity."""
    ca = 60.0
    severity = 1.0
    state = make_district(ca=ca, op=20.0)
    expected_pride = 50.0 + 20 * (ca / 100) * severity
    apply_event(state, make_goal_canada(severity=severity))
    assert state.emotion.pride == pytest.approx(expected_pride, rel=1e-6)


def test_goal_canada_frustration_for_opponent_supporters():
    """Opponent supporters gain frustration = 10 * (op/100) * severity on Canada goal."""
    op = 30.0
    ca = 50.0
    severity = 1.0
    state = make_district(ca=ca, op=op)
    expected_frustration = 50.0 + 10 * (op / 100) * severity
    apply_event(state, make_goal_canada(severity=severity))
    assert state.emotion.frustration == pytest.approx(expected_frustration, rel=1e-6)


def test_goal_opponent_increases_opponent_excitement():
    """On an opponent goal, excitement delta = 30 * (op/100) * severity."""
    op = 35.0
    ca = 50.0
    severity = 1.0
    state = make_district(ca=ca, op=op)
    expected_excitement = 50.0 + 30 * (op / 100) * severity
    apply_event(state, make_goal_opponent(severity=severity))
    assert state.emotion.excitement == pytest.approx(expected_excitement, rel=1e-6)


def test_red_card_canada_increases_tension_and_frustration():
    """Red card on Canada: tension += 25*(ca/100)*s, frustration += 20*(ca/100)*s."""
    ca = 60.0
    severity = 1.0
    state = make_district(ca=ca, op=20.0)
    expected_tension = 50.0 + 25 * (ca / 100) * severity
    expected_frustration = 50.0 + 20 * (ca / 100) * severity
    apply_event(state, make_red_card("canada", severity=severity))
    assert state.emotion.tension == pytest.approx(expected_tension, rel=1e-6)
    assert state.emotion.frustration == pytest.approx(expected_frustration, rel=1e-6)


def test_red_card_opponent_increases_canada_excitement():
    """Red card on opponent: Canada supporters gain excitement = 15*(ca/100)*s."""
    ca = 60.0
    severity = 1.0
    state = make_district(ca=ca, op=20.0)
    expected_excitement = 50.0 + 15 * (ca / 100) * severity
    apply_event(state, make_red_card("opponent", severity=severity))
    assert state.emotion.excitement == pytest.approx(expected_excitement, rel=1e-6)


def test_var_review_team_agnostic_tension():
    """var_review raises tension by 15*severity regardless of team."""
    severity = 0.5
    state = make_district()
    expected_tension = 50.0 + 15 * severity
    apply_event(state, make_var_review(severity=severity))
    assert state.emotion.tension == pytest.approx(expected_tension, rel=1e-6)


def test_elimination_canada_decreases_excitement():
    """Elimination of Canada: excitement -= 40*(ca/100)*severity."""
    ca = 60.0
    severity = 1.0
    state = make_district(ca=ca, op=20.0)
    expected_excitement = 50.0 - 40 * (ca / 100) * severity
    apply_event(state, make_elimination("canada", severity=severity))
    assert state.emotion.excitement == pytest.approx(expected_excitement, rel=1e-6)


def test_elimination_canada_increases_frustration():
    """Elimination of Canada: frustration += 35*(ca/100)*severity."""
    ca = 60.0
    severity = 1.0
    state = make_district(ca=ca, op=20.0)
    expected_frustration = 50.0 + 35 * (ca / 100) * severity
    apply_event(state, make_elimination("canada", severity=severity))
    assert state.emotion.frustration == pytest.approx(expected_frustration, rel=1e-6)


def test_championship_win_canada_max_excitement():
    """Championship win for Canada: excitement += 50*(ca/100)*s."""
    ca = 80.0
    severity = 1.0
    state = make_district(ca=ca, op=10.0)
    expected_excitement = min(100.0, 50.0 + 50 * (ca / 100) * severity)
    apply_event(state, make_championship_win("canada", severity=severity))
    assert state.emotion.excitement == pytest.approx(expected_excitement, rel=1e-6)


def test_apply_event_clamps_excitement_to_100():
    """Excitement must never exceed 100.0 after clamping."""
    state = make_district(ca=100.0, op=0.0)
    state.emotion.excitement = 99.0
    apply_event(state, make_championship_win("canada", severity=1.0))
    assert state.emotion.excitement == pytest.approx(100.0)


def test_apply_event_clamps_excitement_to_0():
    """Excitement must never go below 0.0 after clamping."""
    state = make_district(ca=100.0, op=0.0)
    state.emotion.excitement = 1.0
    apply_event(state, make_elimination("canada", severity=1.0))
    assert state.emotion.excitement == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Tests for decay_state
# ---------------------------------------------------------------------------

def test_decay_reduces_high_state_toward_baseline():
    """excitement=100 decays to 95.0 (100*0.9 + 50*0.1)."""
    state = make_district()
    state.emotion.excitement = 100.0
    decay_state(state)
    assert state.emotion.excitement == pytest.approx(95.0, rel=1e-6)


def test_decay_increases_low_state_toward_baseline():
    """excitement=0 increases to 5.0 (0*0.9 + 50*0.1)."""
    state = make_district()
    state.emotion.excitement = 0.0
    decay_state(state)
    assert state.emotion.excitement == pytest.approx(5.0, rel=1e-6)


def test_decay_leaves_baseline_unchanged():
    """excitement=50 stays at 50.0 after decay (50*0.9 + 50*0.1 == 50)."""
    state = make_district()
    state.emotion.excitement = 50.0
    decay_state(state)
    assert state.emotion.excitement == pytest.approx(50.0, rel=1e-6)


def test_decay_applies_to_all_six_fields():
    """All six fields — excitement, tension, frustration, pride, social, mobility — are decayed."""
    state = make_district()
    state.emotion.excitement = 100.0
    state.emotion.tension = 100.0
    state.emotion.frustration = 100.0
    state.emotion.pride = 100.0
    state.activity.social = 100.0
    state.activity.mobility = 100.0

    decay_state(state)

    assert state.emotion.excitement == pytest.approx(95.0, rel=1e-6)
    assert state.emotion.tension == pytest.approx(95.0, rel=1e-6)
    assert state.emotion.frustration == pytest.approx(95.0, rel=1e-6)
    assert state.emotion.pride == pytest.approx(95.0, rel=1e-6)
    assert state.activity.social == pytest.approx(95.0, rel=1e-6)
    assert state.activity.mobility == pytest.approx(95.0, rel=1e-6)


# ---------------------------------------------------------------------------
# Tests for compute_influence
# ---------------------------------------------------------------------------

def _make_minimal_scenario() -> ScenarioConfig:
    """Minimal scenario with a small set of districts and centroids."""
    return ScenarioConfig(
        scenario_id="test_scenario",
        name="Test",
        city="toronto",
        districts=["downtown", "scarborough", "north_york"],
        event_types=["goal"],
        alignment_field="canada_support",
        teams=["canada", "opponent"],
        director_context="test",
        district_alignments={
            "downtown":    {"canada_support": 60.0, "opponent_support": 20.0, "neutral": 20.0},
            "scarborough": {"canada_support": 80.0, "opponent_support": 10.0, "neutral": 10.0},
            "north_york":  {"canada_support": 75.0, "opponent_support": 12.0, "neutral": 13.0},
        },
        district_centroids={
            "downtown":    [43.6532, -79.3832],
            "scarborough": [43.7764, -79.2318],
            "north_york":  [43.7615, -79.4111],
        },
    )


def test_compute_influence_returns_all_districts():
    """Result length equals number of input district states."""
    scenario = _make_minimal_scenario()
    states = [make_district(d) for d in ["downtown", "scarborough", "north_york"]]
    result = compute_influence(make_goal_canada(), states, scenario)
    assert len(result) == len(states)


def test_compute_influence_returns_correct_rank_type():
    """Each tuple is (DistrictState, int)."""
    scenario = _make_minimal_scenario()
    states = [make_district(d) for d in ["downtown", "scarborough", "north_york"]]
    result = compute_influence(make_goal_canada(), states, scenario)
    for item in result:
        assert isinstance(item, tuple)
        assert len(item) == 2
        district_state, rank = item
        assert isinstance(district_state, DistrictState)
        assert isinstance(rank, int)


def test_downtown_is_rank_zero_for_goal_event():
    """For a goal event (sourced from downtown), the downtown district has rank 0."""
    scenario = _make_minimal_scenario()
    states = [make_district(d) for d in ["downtown", "scarborough", "north_york"]]
    result = compute_influence(make_goal_canada(), states, scenario)
    rank_by_id = {s.district_id: r for s, r in result}
    assert rank_by_id["downtown"] == 0


def test_compute_influence_ranks_are_unique():
    """Ranks 0, 1, 2, ... are all distinct (no ties in rank assignment)."""
    scenario = _make_minimal_scenario()
    states = [make_district(d) for d in ["downtown", "scarborough", "north_york"]]
    result = compute_influence(make_goal_canada(), states, scenario)
    ranks = [r for _, r in result]
    assert len(ranks) == len(set(ranks))


def test_compute_influence_fallback_on_unknown_district():
    """When scenario has no centroids, all districts get rank 0."""
    scenario = ScenarioConfig(
        scenario_id="empty_centroids",
        name="Empty",
        city="toronto",
        districts=["a", "b"],
        event_types=["goal"],
        alignment_field="canada_support",
        teams=["canada", "opponent"],
        director_context="test",
        district_alignments={
            "a": {"canada_support": 50.0, "opponent_support": 25.0, "neutral": 25.0},
            "b": {"canada_support": 50.0, "opponent_support": 25.0, "neutral": 25.0},
        },
        district_centroids={},  # no centroids at all
    )
    states = [make_district("a"), make_district("b")]
    result = compute_influence(make_goal_canada(), states, scenario)
    ranks = [r for _, r in result]
    assert all(r == 0 for r in ranks)
