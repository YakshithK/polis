"""City Simulation Engine — FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.database import lifespan as db_lifespan
from backend.api.sessions import router as sessions_router
from backend.api.sessions import stop_all_engines
from backend.api.websocket import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with db_lifespan(app):
        yield
    await stop_all_engines()


app = FastAPI(
    title="City Simulation Engine",
    description=(
        "Real-time city emotion simulation for World Cup 2026 Toronto scenario."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(sessions_router)
app.include_router(ws_router)
