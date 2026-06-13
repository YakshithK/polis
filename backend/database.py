"""MongoDB connection management for the City Simulation Engine."""

from __future__ import annotations

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = "city_simulation"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    app.state.mongo_client = AsyncIOMotorClient(MONGO_URI, maxPoolSize=100)
    app.state.mongo_db = app.state.mongo_client[DATABASE_NAME]

    try:
        await app.state.mongo_client.admin.command("ping")
        print("Connected to MongoDB successfully via Motor.")
    except Exception as e:
        print(f"MongoDB Connection Failure: {e}")
        raise e

    yield  # Hand control back to FastAPI

    # SHUTDOWN
    app.state.mongo_client.close()
    print("MongoDB connection cleanly shut down.")


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.mongo_db
