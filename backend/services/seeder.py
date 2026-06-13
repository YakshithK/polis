"""District seeder — seeds baseline district states into MongoDB from a scenario config."""

from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.models import ActivityState, AlignmentState, DistrictState, EmotionState
from backend.services.scenario import ScenarioConfig

logger = logging.getLogger(__name__)


async def seed_districts(db: AsyncIOMotorDatabase, scenario: ScenarioConfig) -> None:
    """Upsert baseline DistrictState documents for every district in the scenario."""
    collection = db["districts"]
    seeded = 0

    for district_name in scenario.districts:
        alignment_data = scenario.district_alignments.get(district_name)
        if alignment_data is None:
            raise ValueError(f"No alignment data for district '{district_name}' in scenario '{scenario.scenario_id}'")

        state = DistrictState(
            district_id=district_name,
            emotion=EmotionState(
                excitement=50.0,
                tension=50.0,
                frustration=50.0,
                pride=50.0,
            ),
            alignment=AlignmentState(
                canada_support=alignment_data["canada_support"],
                opponent_support=alignment_data["opponent_support"],
                neutral=alignment_data["neutral"],
            ),
            activity=ActivityState(
                social=50.0,
                mobility=50.0,
            ),
            trend=0.0,
            recent_events=[],
        )

        document = state.model_dump()

        await collection.replace_one(
            {"district_id": district_name},
            document,
            upsert=True,
        )
        seeded += 1

    logger.info("Seeded %d districts for scenario '%s'.", seeded, scenario.scenario_id)
