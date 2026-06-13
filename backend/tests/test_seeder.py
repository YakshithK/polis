"""Unit tests for backend/services/seeder.py — testing load_scenario (pure function)."""

from __future__ import annotations

import pytest

from backend.services.scenario import load_scenario


def test_load_scenario_worldcup_returns_valid_config():
    scenario = load_scenario("worldcup_toronto_2026")
    assert scenario.scenario_id == "worldcup_toronto_2026"
    assert len(scenario.districts) == 12
    assert "scarborough" in scenario.districts
    assert "downtown" in scenario.districts


def test_load_scenario_all_alignments_sum_to_100():
    scenario = load_scenario("worldcup_toronto_2026")
    for district, alignment in scenario.district_alignments.items():
        total = alignment["canada_support"] + alignment["opponent_support"] + alignment["neutral"]
        assert abs(total - 100.0) < 0.5, f"{district} alignment sums to {total}, expected 100"


def test_load_scenario_all_districts_have_centroids():
    scenario = load_scenario("worldcup_toronto_2026")
    for district in scenario.districts:
        assert district in scenario.district_centroids


def test_load_scenario_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        load_scenario("nonexistent_scenario_xyz")
