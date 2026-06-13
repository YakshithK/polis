# Session creation and event injection endpoints

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from backend.database import get_db
from backend.models.event import MatchEvent
from backend.models.session import SimSession
from backend.services.scenario import load_scenario
from backend.services.seeder import seed_districts
from backend.services.engine import SimulationEngine
from backend.services.websocket_manager import ws_manager

router = APIRouter(prefix="/session", tags=["session"])

DEFAULT_SCENARIO_ID = "worldcup_toronto_2026"

# In-memory store of active engines (session_id → SimulationEngine)
_engines: dict[str, SimulationEngine] = {}


async def stop_all_engines() -> None:
    """Stop all running simulation engines and clear the registry."""
    for engine in list(_engines.values()):
        await engine.stop()
    _engines.clear()


@router.post("/", response_model=SimSession, status_code=201)
async def create_session(db: AsyncIOMotorDatabase = Depends(get_db)):
    scenario = load_scenario(DEFAULT_SCENARIO_ID)
    await seed_districts(db, scenario)
    session = SimSession(scenario_id=scenario.scenario_id)
    await db["sessions"].insert_one(session.model_dump())
    engine = SimulationEngine(db=db, scenario=scenario, ws_manager=ws_manager)
    await engine.start()
    _engines[session.session_id] = engine
    return session


@router.get("/{session_id}/state")
async def get_state(
    session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)
):
    engine = _engines.get(session_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Session not found")
    states = await engine.get_all_states()
    return {"session_id": session_id, "districts": [s.model_dump() for s in states]}


@router.post("/{session_id}/event", status_code=202)
async def inject_event(
    session_id: str,
    event: MatchEvent,
):
    engine = _engines.get(session_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Session not found")
    await engine.inject_event(event)
    return {"status": "queued", "event": event.model_dump()}


class AutopilotRequest(BaseModel):
    action: str  # "start" | "stop"
    strictness: str = "conservative"  # "conservative" | "expressive"


@router.post("/{session_id}/autopilot", status_code=202)
async def autopilot(session_id: str, req: AutopilotRequest):
    engine = _engines.get(session_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Session not found")
    if req.action == "start":
        await engine.start_autopilot(expressive=req.strictness == "expressive")
        return {"status": "autopilot_started", "strictness": req.strictness}
    elif req.action == "stop":
        await engine.stop_autopilot()
        return {"status": "autopilot_stopped"}
    raise HTTPException(status_code=400, detail="action must be 'start' or 'stop'")
