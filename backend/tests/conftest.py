"""Pytest fixtures for the Algopolis test suite."""

from __future__ import annotations

import pytest


@pytest.fixture
def mock_db():
    """Minimal mock database fixture.

    Returns a plain dict that can stand in for an AsyncIOMotorDatabase in unit
    tests that exercise pure functions only.  Integration tests that require a
    real (or mongomock) connection are out of scope for Phase 1.
    """
    return {}
