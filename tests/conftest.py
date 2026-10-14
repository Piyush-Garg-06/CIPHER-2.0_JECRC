import os
import pytest
from api.db import Database

# B1: tests use ":memory:" or tmp_path, a fresh DB per test
os.environ["DB_PATH"] = ":memory:"

@pytest.fixture(autouse=True)
def fresh_db_per_test(monkeypatch):
    """Ensure every test runs against a clean fresh in-memory database."""
    test_db = Database(":memory:")
    monkeypatch.setattr("api.db.db", test_db)
    monkeypatch.setattr("api.cohort_v2_store.db", test_db)
    monkeypatch.setattr("api.routes_v2.db", test_db)
    monkeypatch.setattr("api.simulator.db", test_db)
    return test_db
