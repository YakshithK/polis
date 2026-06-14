"""Pydantic models for match events."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MatchEvent(BaseModel):
    """A discrete match event that triggers state changes in city districts."""

    type: str = Field(
        ...,
        description="Event category, e.g. 'goal', 'red_card', 'penalty', 'final_whistle'",
    )
    team: str | None = Field(
        default=None,
        description="Team identifier, e.g. 'canada', 'opponent'. None for organic events.",
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
    custom_effects: dict | None = Field(
        default=None,
        description="Per-district emotion deltas for organic NL events. Keys are district_id, values are emotion dicts.",
    )

