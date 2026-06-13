"""City Simulation Engine — FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler.

    Startup and shutdown logic (e.g. MongoDB connection management) will be
    wired here in Task 1.2: Database Lifespan Management.
    """
    # --- startup ---
    yield
    # --- shutdown ---


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
