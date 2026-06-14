"""Scenario config loader and validator for Algopolis."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel


class ScenarioConfig(BaseModel):
    scenario_id: str
    name: str
    city: str
    city_name: str | None = None
    districts: list[str]
    event_types: list[str]
    alignment_field: str
    teams: list[str]
    director_context: str
    archetype_count: int = 12
    district_alignments: dict[str, dict[str, float]]
    district_centroids: dict[str, list[float]]  # [lat, lon]


def load_scenario(scenario_id: str) -> ScenarioConfig:
    aliases = {"worldcup_toronto_2026": "agentropolis_toronto"}
    resolved_id = aliases.get(scenario_id, scenario_id)
    path = Path(__file__).parent.parent / "scenarios" / f"{resolved_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Scenario config not found: {path}")
    with open(path) as f:
        data = json.load(f)
    data["scenario_id"] = scenario_id
    return ScenarioConfig.model_validate(data)
