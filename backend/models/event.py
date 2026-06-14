"""Pydantic models for simulation events."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


CityEventType = Literal[
    "transit_strike",
    "heat_wave",
    "festival",
    "power_outage",
    "major_layoffs",
    "cultural_event",
    "protest",
    "street_fair",
    "street_party",
    "city_buzz",
    "neighbourhood_chatter",
    "street_party_forming",
    "local_incident",
    "community_gathering",
    "organic",
]


class MatchEvent(BaseModel):
    """A discrete city event that triggers state changes in districts."""

    type: CityEventType = Field(
        ...,
        description="Event category, e.g. 'transit_strike', 'festival', 'power_outage'",
    )
    team: str | None = Field(
        default=None,
        description="Unused — kept for API compatibility. Always null.",
    )
    minute: int = Field(
        ...,
        ge=0,
        le=1440,
        description="Simulation minute within the 24-hour day",
    )
    severity: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Impact magnitude 0–1"
    )
    duration: int | None = Field(
        default=None,
        description="Optional duration of the event in simulation minutes",
    )
    source_district: str | None = Field(
        default=None,
        description="Optional district ID where the event originated (used for organic/local events)",
    )
    custom_effects: dict | None = Field(
        default=None,
        description="Per-district emotion deltas for organic NL events. Keys are district_id, values are emotion dicts.",
    )

