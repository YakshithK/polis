"""Scenario config loader and validator for Polis."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel


class ScenarioConfig(BaseModel):
    scenario_id: str
    name: str
    city: str
    districts: list[str]
    event_types: list[str]
    alignment_field: str
    teams: list[str]
    director_context: str
    district_alignments: dict[str, dict[str, float]]
    district_centroids: dict[str, list[float]]  # [lat, lon]


def load_scenario(scenario_id: str) -> ScenarioConfig:
    path = Path(__file__).parent.parent / "scenarios" / f"{scenario_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Scenario config not found: {path}")
    with open(path) as f:
        data = json.load(f)
    return ScenarioConfig.model_validate(data)
