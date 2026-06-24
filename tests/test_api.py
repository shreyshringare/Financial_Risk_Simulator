import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


def test_health():
    with patch("agent.agent.create_agent", return_value=MagicMock()):
        from api.main import app
        with TestClient(app) as client:
            response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "model" in data
