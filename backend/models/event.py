"""Pydantic models for match events."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field


class MatchEvent(BaseModel):
    """A discrete match event that triggers state changes in city districts."""

    type: str = Field(
        ...,
        description="Event category, e.g. 'goal', 'red_card', 'penalty', 'final_whistle'",
    )
    team: str = Field(
        ...,
        description="Team identifier, e.g. 'canada', 'opponent'",
    )
    minute: int = Field(
        ...,
        ge=0,
        description="Match minute when the event occurred (0-indexed)",
    )
    severity: Annotated[float, Field(ge=0.0, le=1.0)] = Field(
        default=1.0,
        description="Impact weight of this event in the range [0.0, 1.0]",
    )
