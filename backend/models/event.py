"""Pydantic models for match events."""

from __future__ import annotations

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
        le=120,
        description="Match minute (0–120 incl. extra time)",
    )
    severity: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Impact magnitude 0–1"
    )
    source_district: str | None = Field(
        default=None,
        description="Optional district ID where the event originated (used for organic/local events)",
    )

