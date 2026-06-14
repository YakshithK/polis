"""Tests for ambient feed generation."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from backend.models.district import (
    ActivityState,
    AlignmentState,
    DistrictState,
    EmotionState,
)
from backend.services import narrator


def _district() -> DistrictState:
    return DistrictState(
        district_id="scarborough",
        emotion=EmotionState(excitement=72, tension=30, frustration=10, pride=55),
        alignment=AlignmentState(canada_support=82, opponent_support=8, neutral=10),
        activity=ActivityState(social=60, mobility=50),
        trend=0.1,
        recent_events=[],
    )


@pytest.mark.asyncio
async def test_generate_ambient_post_returns_text_and_character():
    state = _district()
    with patch.object(narrator, "_get_client") as mock_get:
        mock_client = AsyncMock()
        mock_get.return_value = mock_client
        mock_client.chat.completions.create = AsyncMock(
            return_value=type(
                "Resp",
                (),
                {
                    "choices": [
                        type("C", (), {"message": type("M", (), {"content": "Block feels electric tonight."})()})()
                    ]
                },
            )()
        )
        text, character = await narrator.generate_ambient_post(state, clock_minute=23)

    assert isinstance(text, str) and len(text) > 0
    assert isinstance(character, str) and len(character) > 0


@pytest.mark.asyncio
async def test_generate_ambient_post_fallback_on_error():
    state = _district()
    with patch.object(narrator, "_get_client", side_effect=RuntimeError("offline")):
        text, character = await narrator.generate_ambient_post(state, clock_minute=10)

    assert "Scarborough" in text or "scarborough" in text.lower() or "mood" in text.lower()
    assert character
