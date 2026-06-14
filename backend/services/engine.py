# The simulation engine: event queue + processing loop + state management

import asyncio
import logging
import random
import time

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.models.district import DistrictState
from backend.models.event import MatchEvent
from backend.services.scenario import ScenarioConfig
from backend.services.rules import apply_event, compute_influence, decay_state, _clamp_state
from backend.services.narrator import generate_feed_text, pick_key_districts
from backend.services.director import generate_timeline
from backend.services.characters import pick_character

_ORGANIC_EVENTS = [
    ("street_party",          {"excitement": 8,  "pride": 5,  "social": 10}),
    ("pub_crowd",             {"excitement": 6,  "social": 12, "tension": 3}),
    ("fan_gathering",         {"excitement": 10, "social": 8}),
    ("city_buzz",             {"excitement": 5,  "social": 6}),
    ("neighbourhood_chatter", {"social": 8,      "tension": -3}),
]

_ORGANIC_FEED = {
    "street_party":          ["Whole block is out tonight.", "Street's alive — can't even walk fast.", "People just pouring out."],
    "pub_crowd":             ["Can't get a seat in here.", "Every screen in the pub is on.", "This city does not go quiet."],
    "fan_gathering":         ["Word is spreading fast.", "You can feel something building.", "Nobody's going home yet."],
    "city_buzz":             ["Toronto's awake tonight.", "Energy out there is real.", "Something in the air."],
    "neighbourhood_chatter": ["Group chat is on fire.", "Everyone's got an opinion.", "Checking in on the block."],
}

logger = logging.getLogger(__name__)


class SimulationEngine:
    def __init__(self, db: AsyncIOMotorDatabase, scenario: ScenarioConfig, ws_manager=None):
        self.db = db
        self.scenario = scenario
        self.ws_manager = ws_manager
        self.event_queue: asyncio.Queue[tuple[MatchEvent, str]] = asyncio.Queue()
        self._running = False
        self._task: asyncio.Task | None = None
        self._tick_task: asyncio.Task | None = None
        self._autopilot_task: asyncio.Task | None = None
        self._autopilot_timeline: list[MatchEvent] = []
        self._autopilot_active = False
        self.simulation_clock = 0
        self._lock = asyncio.Lock()
        self._last_manual_event_time = 0.0

    async def start(self) -> None:
        """Load district states from DB and start the background processing loops."""
        self._running = True
        self._task = asyncio.create_task(self._processing_loop())
        self._tick_task = asyncio.create_task(self._tick_loop())
        logger.info(
            "Simulation engine started for scenario '%s'", self.scenario.scenario_id
        )

    async def stop(self) -> None:
        """Stop the loops gracefully."""
        self._running = False
        await self.stop_autopilot()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._tick_task:
            self._tick_task.cancel()
            try:
                await self._tick_task
            except asyncio.CancelledError:
                pass
        logger.info("Simulation engine stopped.")

    async def start_autopilot(self, expressive: bool = False) -> None:
        """Generate a match timeline and let the tick loop drive the match clock."""
        await self.stop_autopilot()
        self.simulation_clock = 0
        self._autopilot_timeline = []
        self._autopilot_active = True
        self._autopilot_task = asyncio.create_task(self._autopilot_run(expressive))

    async def stop_autopilot(self) -> None:
        if self._autopilot_task and not self._autopilot_task.done():
            self._autopilot_task.cancel()
            try:
                await self._autopilot_task
            except asyncio.CancelledError:
                pass
        self._autopilot_task = None
        self._autopilot_active = False

    async def _autopilot_run(self, expressive: bool) -> None:
        try:
            context = self.scenario.director_context
            await self.ws_manager.broadcast({"type": "autopilot", "status": "generating"})
            timeline = await generate_timeline(context, expressive=expressive)
            self._autopilot_timeline = timeline
            
            # Reset clock to 0 and start the match!
            self.simulation_clock = 0
            await self.ws_manager.broadcast({
                "type": "autopilot", 
                "status": "running", 
                "events": len(timeline),
                "timeline": [e.model_dump() for e in timeline]
            })
            logger.info("Autopilot initialized with %d events, expressive=%s", len(timeline), expressive)
            
            # Just keep this task alive until we reach 90 or it is cancelled
            while self._running and self._autopilot_active and self.simulation_clock < 90:
                await asyncio.sleep(0.5)
            
            if self.simulation_clock >= 90:
                self._autopilot_active = False
                await self.ws_manager.broadcast({"type": "autopilot", "status": "finished"})
        except asyncio.CancelledError:
            self._autopilot_active = False
            logger.info("Autopilot task cancelled.")
        except Exception:
            logger.exception("Error in autopilot run")
            self._autopilot_active = False
            await self.ws_manager.broadcast({"type": "autopilot", "status": "idle"})

    async def inject_event(self, event: MatchEvent, *, source: str = "autopilot") -> None:
        """Enqueue an event for processing.

        source: 'manual' (UI buttons), 'autopilot' (director timeline), or 'organic' (tick roll).
        Only manual injections suppress organic events for 30s.
        """
        await self.event_queue.put((event, source))

    async def get_all_states(self) -> list[DistrictState]:
        """Return current district states from DB."""
        docs = await self.db["districts"].find({}).to_list(length=None)
        return [DistrictState.model_validate(doc) for doc in docs]

    async def _processing_loop(self) -> None:
        """Main event loop: dequeue → apply rules → broadcast."""
        while self._running:
            try:
                event, source = await self.event_queue.get()
            except asyncio.CancelledError:
                break
            except Exception:
                continue
            try:
                logger.info(
                    "Processing event: %s for %s at minute %s (source=%s)",
                    event.type, event.team, event.minute, source,
                )
                await self._process_event(event, source=source)
            except Exception:
                logger.exception("Unhandled error processing event %s — skipping", event.type)
            finally:
                self.event_queue.task_done()

    async def _process_event(self, event: MatchEvent, *, source: str = "autopilot") -> None:
        """Apply deterministic delta rules to all districts, then broadcast."""
        if source == "manual":
            self._last_manual_event_time = time.time()
            logger.info("Manual event: %s. Suppressing organic events for 30s.", event.type)

        async with self._lock:
            states = await self.get_all_states()
            influenced = compute_influence(event, states, self.scenario)
            for district_state, distance_rank in influenced:
                apply_event(district_state, event, distance_rank=distance_rank)
                await self._save_state(district_state)
        await self._broadcast_update(influenced, event, source=source)
        asyncio.create_task(self._broadcast_feed(influenced, event))

    async def _tick_loop(self) -> None:
        """Runs once per second: increment clock, decay, breathe, roll organic event, broadcast."""
        while self._running:
            try:
                await asyncio.sleep(1.0)
                if not self._running:
                    break
                
                self.simulation_clock = min(self.simulation_clock + 1, 90)
                
                async with self._lock:
                    states = await self.get_all_states()
                    for state in states:
                        decay_state(state)
                        state.emotion.excitement  += random.uniform(-0.8, 0.8)
                        state.emotion.tension     += random.uniform(-0.6, 0.6)
                        state.emotion.frustration += random.uniform(-0.4, 0.4)
                        state.emotion.pride       += random.uniform(-0.5, 0.5)
                        state.activity.social     += random.uniform(-1.0, 1.0)
                        _clamp_state(state)
                    # Batch all 12 writes in one round-trip instead of 12 serial
                    # Atlas calls (was holding the lock ~600ms; now ~50ms).
                    await self._save_states_batch(states)
                
                # Check for autopilot timeline events (skip halftime/fulltime minutes)
                if self._autopilot_active and self.simulation_clock not in (45, 90):
                    current_events = [
                        e for e in self._autopilot_timeline
                        if e.minute == self.simulation_clock
                    ]
                    for event in current_events:
                        logger.info(
                            "Autopilot injecting scheduled event: %s at minute %d",
                            event.type, event.minute,
                        )
                        await self.inject_event(event, source="autopilot")
                
                # Roll for organic events (4% chance per tick) if not suppressed
                if self.simulation_clock < 90 and random.random() < 0.04:
                    if time.time() - self._last_manual_event_time > 30.0:
                        await self._trigger_random_organic_event()
                    else:
                        logger.info("Organic event suppressed (30s cooldown active)")
                
                # Roll for ambient feed posts every 5 seconds (15% chance)
                if self.simulation_clock > 0 and self.simulation_clock % 5 == 0:
                    if random.random() < 0.15:
                        asyncio.create_task(self._trigger_ambient_feed_posts(states))
                
                # Broadcast tick (decay/breathing/clock)
                await self._broadcast_tick(states)
                
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Error in simulation tick loop")

    async def _trigger_random_organic_event(self) -> None:
        """Trigger a random minor organic event in a random district."""
        event_types = [
            "street_party",
            "pub_crowd",
            "fan_gathering",
            "city_buzz",
            "neighbourhood_chatter",
            "fan_fight",
            "street_party_forming"
        ]
        evt_type = random.choice(event_types)
        districts = self.scenario.districts
        if not districts:
            return
        source_district = random.choice(districts)
        
        team = random.choice(["canada", "opponent"])
        severity = round(random.uniform(0.3, 0.7), 2)
        
        event = MatchEvent(
            type=evt_type,
            team=team,
            minute=self.simulation_clock,
            severity=severity,
            source_district=source_district
        )
        logger.info("Triggering organic event: %s at %s at minute %d", evt_type, source_district, self.simulation_clock)
        await self.inject_event(event, source="organic")

    async def _save_state(self, state: DistrictState) -> None:
        """Persist a single district state to MongoDB."""
        await self.db["districts"].replace_one(
            {"district_id": state.district_id},
            state.model_dump(),
            upsert=True,
        )

    async def _save_states_batch(self, states: list[DistrictState]) -> None:
        """Persist all district states in one MongoDB round-trip."""
        from pymongo import ReplaceOne
        ops = [
            ReplaceOne(
                {"district_id": s.district_id},
                s.model_dump(),
                upsert=True,
            )
            for s in states
        ]
        if ops:
            await self.db["districts"].bulk_write(ops, ordered=False)

    async def _broadcast_update(
        self,
        influenced: list[tuple[DistrictState, int]],
        event: MatchEvent,
        *,
        source: str = "autopilot",
    ) -> None:
        """Broadcast state update to WebSocket clients."""
        if not self.ws_manager:
            return
        payload = {
            "type": "update",
            "source": source,
            "event": event.model_dump(),
            "districts": [
                {**s.model_dump(), "distance_rank": rank}
                for s, rank in influenced
            ],
        }
        await self.ws_manager.broadcast(payload)

    async def _broadcast_tick(self, states: list[DistrictState]) -> None:
        """Broadcast simulation clock tick and updated district states to clients."""
        if not self.ws_manager:
            return
        payload = {
            "type": "tick",
            "minute": self.simulation_clock,
            "districts": [s.model_dump() for s in states],
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
        results = await asyncio.gather(*tasks, return_exceptions=True)
        ts = int(time.time())
        for state, result in zip(key_districts, results):
            if isinstance(result, tuple):
                text, character = result
            else:
                text = f"The city is reacting to minute {event.minute}."
                character = None
            await self.ws_manager.broadcast({
                "type": "feed",
                "district": state.district_id,
                "character": character,
                "text": text,
                "ts": ts,
            })

    async def _trigger_ambient_feed_posts(self, states: list[DistrictState]) -> None:
        """Pick 2-3 districts and broadcast ambient posts reacting to general city vibe."""
        if not self.ws_manager:
            return
        count = min(len(states), random.randint(2, 3))
        selected = random.sample(states, count)
        
        from backend.services.narrator import generate_ambient_post
        
        tasks = [generate_ambient_post(s, self.simulation_clock) for s in selected]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        ts = int(time.time())
        for state, result in zip(selected, results):
            if isinstance(result, tuple):
                text, character = result
            else:
                text = f"The vibe in {state.district_id.replace('_', ' ').title()} is intense right now."
                character = None
            await self.ws_manager.broadcast({
                "type": "feed",
                "district": state.district_id,
                "character": character,
                "text": text,
                "ts": ts,
            })

