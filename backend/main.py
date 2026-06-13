"""City Simulation Engine — FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI

from database import lifespan


app = FastAPI(
    title="City Simulation Engine",
    description=(
        "Real-time city emotion simulation for World Cup 2026 Toronto scenario."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Routes will be registered here in subsequent tasks.
# ---------------------------------------------------------------------------
