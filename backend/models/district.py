"""Pydantic models for district simulation state."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field


class EmotionState(BaseModel):
    """Emotional intensity scores for a district. All values are floats 0–100."""

    excitement: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    tension: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    frustration: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    pride: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0


class AlignmentState(BaseModel):
    """Community alignment breakdown for a district."""

    neutral: Annotated[float, Field(ge=0.0, le=100.0)] = 100.0


class ActivityState(BaseModel):
    """Activity level scores for a district. All values are floats 0–100."""

    social: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    mobility: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0


class RecentEvent(BaseModel):
    """A compact record of a recent match event stored inside district state."""

    type: str
    team: str
    minute: int


DominantEmotion = Literal["excitement", "tension", "frustration", "pride"]


class ActiveEffect(BaseModel):
    """A time-decaying event effect on district emotions."""

    model_config = ConfigDict(populate_by_name=True)

    event_type: str
    team: str | None = None
    start_minute: int
    duration_minutes: int
    peak_deltas: dict[str, float] = Field(default_factory=dict)

    def strength(self, current_minute: int) -> float:
        """Linear decay from 1.0 → 0.0 over duration_minutes."""
        elapsed = current_minute - self.start_minute
        return max(0.0, 1.0 - (elapsed / self.duration_minutes))

    def is_expired(self, current_minute: int) -> bool:
        return self.strength(current_minute) <= 0.0


class DistrictState(BaseModel):
    """Full simulation state for a single city district."""

    model_config = ConfigDict(populate_by_name=True)

    district_id: str
    emotion: EmotionState = Field(default_factory=EmotionState)
    alignment: AlignmentState = Field(default_factory=AlignmentState)
    activity: ActivityState = Field(default_factory=ActivityState)
    trend: float = Field(
        default=0.0,
        description="Rate of change of dominant emotion per tick, range [-1, 1]",
    )
    recent_events: list[RecentEvent] = Field(default_factory=list)
    active_effects: list[ActiveEffect] = Field(default_factory=list)

    @computed_field  # type: ignore[misc]
    @property
    def dominant(self) -> DominantEmotion:
        scores: dict[str, float] = {
            "excitement": self.emotion.excitement,
            "tension": self.emotion.tension,
            "frustration": self.emotion.frustration,
            "pride": self.emotion.pride,
        }
        return max(scores, key=lambda k: scores[k])  # type: ignore[return-value]

    def compute_emotions(self, current_minute: int) -> EmotionState:
        """Baseline + all active effects weighted by current strength."""
        baseline = 50.0
        excitement = baseline
        tension = baseline
        pride = baseline
        frustration = baseline

        for effect in self.active_effects:
            s = effect.strength(current_minute)
            if s <= 0:
                continue
            excitement   += effect.peak_deltas.get("excitement",   0.0) * s
            tension      += effect.peak_deltas.get("tension",      0.0) * s
            pride        += effect.peak_deltas.get("pride",        0.0) * s
            frustration  += effect.peak_deltas.get("frustration",  0.0) * s

        def clamp(v: float) -> float:
            return max(0.0, min(100.0, v))

        return EmotionState(
            excitement=clamp(excitement),
            tension=clamp(tension),
            pride=clamp(pride),
            frustration=clamp(frustration),
        )

    def prune_expired(self, current_minute: int) -> None:
        self.active_effects = [e for e in self.active_effects if not e.is_expired(current_minute)]
