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


def test_callback_emits_status_on_tool_start():
    import asyncio
    import json
    from api.callback_handler import AnalystCallbackHandler, _tool_label

    async def run():
        cb = AnalystCallbackHandler()
        await cb.on_tool_start({"name": "fetch_stock_data"}, "AAPL")
        return cb.queue.get_nowait()

    item = asyncio.run(run())
    payload = json.loads(item)

    assert payload == {
        "type": "status",
        "tool": "fetch_stock_data",
        "label": _tool_label("fetch_stock_data"),
    }
    assert payload["label"] == "Fetching market data"
