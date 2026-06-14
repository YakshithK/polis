import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.api.sessions import _engines
from backend.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    # Exact match first; fall back to any running engine (handles server restarts
    # and React StrictMode double-mount where stop_all_engines kills the old session).
    engine = _engines.get(session_id) or (next(iter(_engines.values()), None) if _engines else None)
    if not engine:
        await websocket.close(code=4004)
        return
    # Attach manager to engine if not already set
    engine.ws_manager = ws_manager
    await ws_manager.connect(websocket)
    try:
        # Send current state snapshot on connect
        states = await engine.get_all_states()
        await websocket.send_json({
            "type": "snapshot",
            "districts": [s.model_dump() for s in states],
        })
        # Keep connection alive — engine drives all outbound messages
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
