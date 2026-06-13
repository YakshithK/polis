"""MongoDB connection management for Algopolis."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

load_dotenv()

logger = logging.getLogger(__name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = "algopolis"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    app.state.mongo_client = AsyncIOMotorClient(
        MONGO_URI,
        maxPoolSize=100,
        serverSelectionTimeoutMS=5000,
    )
    app.state.mongo_db = app.state.mongo_client[DATABASE_NAME]

    try:
        await app.state.mongo_client.admin.command("ping")
        logger.info("Connected to MongoDB.")
    except Exception as e:
        logger.error("MongoDB connection failure: %s", e)
        raise e

    yield  # Hand control back to FastAPI

    # SHUTDOWN
    app.state.mongo_client.close()
    logger.info("MongoDB connection closed.")


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.mongo_db
