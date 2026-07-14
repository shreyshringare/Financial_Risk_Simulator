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


def test_cors_origins_default_localhost(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
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


def test_build_suggestions_from_headlines(monkeypatch):
    import api.suggestions as suggestions_mod

    fake_articles = [
        {"title": "Nvidia surges on AI chip demand"},
        {"title": "Apple faces EU fine"},
    ]
    monkeypatch.setattr(suggestions_mod, "fetch_market_headlines", lambda max_articles=10: fake_articles)
    # Bypass the module-level TTL cache so the monkeypatched fetch is used.
    monkeypatch.setattr(suggestions_mod, "_get_cached", lambda: None)
    monkeypatch.setattr(suggestions_mod, "_set_cached", lambda data: None)

    result = suggestions_mod.build_suggestions()
    queries = [s["query"] for s in result["suggestions"]]

    assert any("NVDA" in q for q in queries)
    assert any("AAPL" in q for q in queries)
    assert len(result["suggestions"]) >= 8

    nvda_suggestion = next(s for s in result["suggestions"] if "NVDA" in s["query"])
    aapl_suggestion = next(s for s in result["suggestions"] if "AAPL" in s["query"])
    assert nvda_suggestion["source"] is not None
    assert aapl_suggestion["source"] is not None


def test_suggestions_endpoint_returns_200(monkeypatch):
    import api.suggestions as suggestions_mod

    fake_articles = [{"title": "Nvidia surges on AI chip demand"}]
    monkeypatch.setattr(suggestions_mod, "fetch_market_headlines", lambda max_articles=10: fake_articles)
    monkeypatch.setattr(suggestions_mod, "_get_cached", lambda: None)
    monkeypatch.setattr(suggestions_mod, "_set_cached", lambda data: None)

    mock_agent_module = MagicMock()
    with __import__("unittest.mock", fromlist=["patch"]).patch.dict(
        sys.modules, {"agent.agent": mock_agent_module}
    ):
        from api.main import app
        client = TestClient(app)
        response = client.get("/api/suggestions")

    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data


def test_build_suggestions_fallback_on_error(monkeypatch):
    import api.suggestions as suggestions_mod

    def _raise(max_articles=10):
        raise RuntimeError("network down")

    monkeypatch.setattr(suggestions_mod, "fetch_market_headlines", _raise)
    monkeypatch.setattr(suggestions_mod, "_get_cached", lambda: None)
    monkeypatch.setattr(suggestions_mod, "_set_cached", lambda data: None)

    result = suggestions_mod.build_suggestions()
    assert len(result["suggestions"]) >= 8
    assert all(s["source"] is None for s in result["suggestions"])


# ── ChatRequest validation ────────────────────────────────────────────────────

def test_chatrequest_rejects_blank_message():
    from pydantic import ValidationError
    from api.main import ChatRequest

    with __import__("pytest").raises(ValidationError, match="blank"):
        ChatRequest(message="   ")


def test_chatrequest_rejects_whitespace_only():
    from pydantic import ValidationError
    from api.main import ChatRequest

    with __import__("pytest").raises(ValidationError):
        ChatRequest(message="\t\n")


def test_chatrequest_rejects_oversized_message():
    from pydantic import ValidationError
    from api.main import ChatRequest

    with __import__("pytest").raises(ValidationError):
        ChatRequest(message="x" * 2001)


def test_chatrequest_accepts_valid_message():
    from api.main import ChatRequest

    req = ChatRequest(message="What is the VaR for AAPL?")
    assert req.message == "What is the VaR for AAPL?"


def test_chatrequest_rejects_invalid_history_role():
    from pydantic import ValidationError
    from api.main import ChatRequest

    with __import__("pytest").raises(ValidationError, match="role"):
        ChatRequest(
            message="hello",
            history=[{"role": "system", "content": "you are a bot"}],
        )


def test_chatrequest_rejects_empty_history_content():
    from pydantic import ValidationError
    from api.main import ChatRequest

    with __import__("pytest").raises(ValidationError):
        ChatRequest(
            message="hello",
            history=[{"role": "user", "content": "  "}],
        )


def test_chatrequest_caps_history_at_10_turns():
    from api.main import ChatRequest

    turns = [{"role": "user", "content": f"msg {i}"} for i in range(20)]
    req = ChatRequest(message="hi", history=turns)
    assert len(req.history) == 10
    # Should keep the last 10
    assert req.history[0]["content"] == "msg 10"


def test_chatrequest_accepts_valid_history():
    from api.main import ChatRequest

    history = [
        {"role": "user", "content": "What is VaR?"},
        {"role": "assistant", "content": "VaR measures tail risk."},
    ]
    req = ChatRequest(message="follow up", history=history)
    assert len(req.history) == 2
