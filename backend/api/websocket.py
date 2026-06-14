import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.api.sessions import _engines
from backend.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    # Always accept first — never 403, which causes the frontend to loop forever.
    await websocket.accept()
    # Exact match first; fall back to any running engine (handles server restarts
    # and StrictMode double-mount where stop_all_engines kills the exact session).
    engine = _engines.get(session_id) or (next(iter(_engines.values()), None) if _engines else None)
    if not engine:
        # Tell the frontend there is no active engine so it must create a new session.
        await websocket.send_json({"type": "no_session"})
        await websocket.close(code=4000)
        return
    # Attach manager to engine if not already set
    engine.ws_manager = ws_manager
    ws_manager.active_connections.append(websocket)
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
