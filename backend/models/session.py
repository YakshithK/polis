"""Pydantic models for simulation sessions."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from .district import DistrictState
from .event import MatchEvent


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class SimSession(BaseModel):
    """Top-level simulation session document stored in MongoDB."""

    session_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique identifier for this simulation run",
    )
    scenario_id: str = Field(
        default="worldcup_toronto_2026",
        description="Which scenario configuration this session uses",
    )
    created_at: datetime = Field(
        default_factory=_utcnow,
        description="UTC timestamp when the session was created",
    )
    district_states: list[DistrictState] = Field(
        default_factory=list,
        description="Current state snapshot for every district in the scenario",
    )
    events: list[MatchEvent] = Field(
        default_factory=list,
        description="Ordered log of all match events processed so far",
    )
