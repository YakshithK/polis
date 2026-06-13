"""Unit tests for Pydantic model validation in backend/models/."""

from __future__ import annotations

import pytest
import pydantic

from backend.models.district import (
    ActivityState,
    AlignmentState,
    DistrictState,
    EmotionState,
)
from backend.models.event import MatchEvent
from backend.models.session import SimSession


def test_district_state_dominant_is_highest_emotion():
    state = DistrictState(
        district_id="test",
        emotion=EmotionState(excitement=80.0, tension=30.0, frustration=20.0, pride=60.0),
        alignment=AlignmentState(canada_support=60.0, opponent_support=20.0, neutral=20.0),
        activity=ActivityState(social=50.0, mobility=50.0),
    )
    assert state.dominant == "excitement"


def test_district_state_dominant_updates_after_mutation():
    state = DistrictState(
        district_id="test",
        emotion=EmotionState(excitement=80.0, tension=30.0, frustration=20.0, pride=60.0),
        alignment=AlignmentState(canada_support=60.0, opponent_support=20.0, neutral=20.0),
        activity=ActivityState(social=50.0, mobility=50.0),
    )
    state.emotion.tension = 90.0
    assert state.dominant == "tension"  # recomputes live


def test_alignment_sum_validation():
    with pytest.raises(pydantic.ValidationError):  # Pydantic ValidationError
        AlignmentState(canada_support=50.0, opponent_support=50.0, neutral=10.0)  # sums to 110


def test_match_event_minute_upper_bound():
    with pytest.raises(pydantic.ValidationError):
        MatchEvent(type="goal", team="canada", minute=999)


def test_session_id_auto_generated():
    s1 = SimSession(scenario_id="worldcup_toronto_2026")
    s2 = SimSession(scenario_id="worldcup_toronto_2026")
    assert s1.session_id != s2.session_id
    assert len(s1.session_id) > 0
