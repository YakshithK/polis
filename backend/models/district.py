"""Pydantic models for district simulation state."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


class EmotionState(BaseModel):
    """Emotional intensity scores for a district. All values are floats 0–100."""

    excitement: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    tension: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    frustration: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    pride: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0


class AlignmentState(BaseModel):
    """Fan alignment breakdown for a district. Fields should sum to 100."""

    canada_support: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    opponent_support: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    neutral: Annotated[float, Field(ge=0.0, le=100.0)] = 100.0

    @model_validator(mode="after")
    def check_sum(self) -> "AlignmentState":
        total = self.canada_support + self.opponent_support + self.neutral
        if abs(total - 100.0) > 0.5:
            raise ValueError(
                f"AlignmentState fields must sum to 100, got {total:.2f}"
            )
        return self


class ActivityState(BaseModel):
    """Activity level scores for a district. All values are floats 0–100."""

    social: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    mobility: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0


class RecentEvent(BaseModel):
    """A compact record of a recent match event stored inside district state."""

    type: str
    team: str
    minute: int


# Dominant emotion is one of the four emotion field names.
DominantEmotion = Literal["excitement", "tension", "frustration", "pride"]


class DistrictState(BaseModel):
    """Full simulation state for a single city district."""

    id: str
    emotion: EmotionState = Field(default_factory=EmotionState)
    alignment: AlignmentState = Field(default_factory=AlignmentState)
    activity: ActivityState = Field(default_factory=ActivityState)
    dominant: DominantEmotion = "excitement"
    trend: float = 0.0
    recent_events: list[RecentEvent] = Field(default_factory=list)

    @model_validator(mode="after")
    def compute_dominant(self) -> "DistrictState":
        """Recompute the dominant emotion from the current emotion sub-model."""
        scores: dict[str, float] = {
            "excitement": self.emotion.excitement,
            "tension": self.emotion.tension,
            "frustration": self.emotion.frustration,
            "pride": self.emotion.pride,
        }
        self.dominant = max(scores, key=lambda k: scores[k])  # type: ignore[assignment]
        return self
