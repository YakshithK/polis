# The simulation engine: event queue + processing loop + state management

import asyncio
import logging
import time

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.models.district import DistrictState
from backend.models.event import MatchEvent
from backend.services.scenario import ScenarioConfig
from backend.services.rules import apply_event, compute_influence, decay_state
from backend.services.narrator import generate_feed_text, pick_key_districts

logger = logging.getLogger(__name__)


class SimulationEngine:
    def __init__(self, db: AsyncIOMotorDatabase, scenario: ScenarioConfig, ws_manager=None):
        self.db = db
        self.scenario = scenario
        self.ws_manager = ws_manager
        self.event_queue: asyncio.Queue[MatchEvent] = asyncio.Queue()
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Load district states from DB and start the background processing loop."""
        self._running = True
        self._task = asyncio.create_task(self._processing_loop())
        logger.info(
            "Simulation engine started for scenario '%s'", self.scenario.scenario_id
        )

    async def stop(self) -> None:
        """Stop the processing loop gracefully."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Simulation engine stopped.")

    async def inject_event(self, event: MatchEvent) -> None:
        """Enqueue an event for processing."""
        await self.event_queue.put(event)

    async def get_all_states(self) -> list[DistrictState]:
        """Return current district states from DB."""
        docs = await self.db["districts"].find({}).to_list(length=None)
        return [DistrictState.model_validate(doc) for doc in docs]

    async def _processing_loop(self) -> None:
        """Main event loop: dequeue → apply rules → decay → broadcast."""
        while self._running:
            try:
                event = await asyncio.wait_for(self.event_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                await self._decay_tick()
                await self._broadcast_pulse()
                continue
            try:
                logger.info("Processing event: %s for %s at minute %s", event.type, event.team, event.minute)
                await self._process_event(event)
            except Exception:
                logger.exception("Unhandled error processing event %s — skipping", event.type)
            finally:
                self.event_queue.task_done()

    async def _process_event(self, event: MatchEvent) -> None:
        """Apply deterministic delta rules to all districts, then decay, then broadcast."""
        states = await self.get_all_states()
        influenced = compute_influence(event, states, self.scenario)
        for district_state, distance_rank in influenced:
            apply_event(district_state, event)
            decay_state(district_state)
            await self._save_state(district_state)
        await self._broadcast_update(influenced, event)
        asyncio.create_task(self._broadcast_feed(influenced, event))

    async def _decay_tick(self) -> None:
        """Apply decay to all district states."""
        states = await self.get_all_states()
        for state in states:
            decay_state(state)
            await self._save_state(state)

    async def _save_state(self, state: DistrictState) -> None:
        """Persist a district state to MongoDB."""
        await self.db["districts"].replace_one(
            {"district_id": state.district_id},
            state.model_dump(),
            upsert=True,
        )

    async def _broadcast_update(
        self,
        influenced: list[tuple[DistrictState, int]],
        event: MatchEvent,
    ) -> None:
        """Broadcast state update to WebSocket clients."""
        if not self.ws_manager:
            return
        payload = {
            "type": "update",
            "event": event.model_dump(),
            "districts": [
                {**s.model_dump(), "distance_rank": rank}
                for s, rank in influenced
            ],
        }
        await self.ws_manager.broadcast(payload)

    async def _broadcast_feed(
        self,
        influenced: list[tuple[DistrictState, int]],
        event: MatchEvent,
    ) -> None:
        """Generate and broadcast social feed posts for 2-3 key districts (non-blocking)."""
        if not self.ws_manager:
            return
        key_districts = pick_key_districts(
            influenced, self.scenario.district_alignments
        )
        tasks = [generate_feed_text(event, state) for state in key_districts]
        texts = await asyncio.gather(*tasks, return_exceptions=True)
        ts = int(time.time())
        for state, result in zip(key_districts, texts):
            text = result if isinstance(result, str) else f"The city is reacting to minute {event.minute}."
            await self.ws_manager.broadcast({
                "type": "feed",
                "district": state.district_id,
                "text": text,
                "ts": ts,
            })

    async def _broadcast_pulse(self) -> None:
        """Broadcast heartbeat to WebSocket clients."""
        if not self.ws_manager:
            return
        await self.ws_manager.broadcast({"type": "pulse", "timestamp": int(time.time())})
