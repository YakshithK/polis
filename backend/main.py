"""Algopolis — FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    title="Algopolis",
    description="Real-time city emotion simulation for Toronto.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(sessions_router)
app.include_router(ws_router)
