import sys
import importlib
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


def test_health():
    # Prevent langchain (Pydantic v1, Python 3.14 incompatible) from being
    # imported during the test. The health endpoint does not use the agent.
    mock_agent_module = MagicMock()
    with __import__("unittest.mock", fromlist=["patch"]).patch.dict(
        sys.modules, {"agent.agent": mock_agent_module}
    ):
        from api.main import app
        # No context manager — skips lifespan (agent startup) entirely.
        # Health endpoint needs no agent state.
        client = TestClient(app)
        response = client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "model" in data


def test_cors_origins_from_env(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://a.example,https://b.example")
    import api.main
    importlib.reload(api.main)
    origins = api.main._allowed_origins()
    assert origins == ["https://a.example", "https://b.example"]
    monkeypatch.delenv("ALLOWED_ORIGINS")
    importlib.reload(api.main)


def test_cors_origins_default_localhost():
    import api.main
    assert api.main._allowed_origins() == ["http://localhost:3000"]
