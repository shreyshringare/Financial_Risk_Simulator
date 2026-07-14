"""Tests for agent/agent.py — LLM and executor are mocked."""
import os
import sys
import pytest
from unittest.mock import patch, MagicMock

# langchain uses Pydantic v1 internals that crash on Python 3.14 (`Optional[dict[str, Any]]`
# triggers TypeError: 'function' object is not subscriptable).
# CI runs Python 3.11 where these pass fine.
pytestmark = pytest.mark.skipif(
    sys.version_info >= (3, 14),
    reason="langchain Pydantic v1 incompatible with Python 3.14+",
)


class TestBuildLlm:

    def test_returns_groq_when_groq_key_set(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)

        mock_groq = MagicMock()
        with patch("agent.agent.ChatGroq", return_value=mock_groq) as mock_cls:
            from agent.agent import build_llm
            result = build_llm()

        mock_cls.assert_called_once()
        assert result is mock_groq

    def test_returns_openai_when_no_groq_key(self, monkeypatch):
        monkeypatch.delenv("GROQ_API_KEY", raising=False)

        mock_openai = MagicMock()
        with patch("agent.agent.ChatOpenAI", return_value=mock_openai) as mock_cls:
            from agent import agent as agent_mod
            import importlib
            importlib.reload(agent_mod)
            result = agent_mod.build_llm()

        mock_cls.assert_called_once()
        assert result is mock_openai


class TestMakeExecutor:

    def test_executor_has_correct_limits(self):
        from agent.agent import make_executor

        mock_llm = MagicMock()
        mock_llm.bind = MagicMock(return_value=mock_llm)

        with patch("agent.agent.create_react_agent", return_value=MagicMock()), \
             patch("agent.agent.AgentExecutor") as mock_ae:
            mock_ae.return_value = MagicMock()
            make_executor(mock_llm)

        call_kwargs = mock_ae.call_args.kwargs
        assert call_kwargs["max_iterations"] == 10
        assert call_kwargs["max_execution_time"] == 120

    def test_executor_returns_agent_executor(self):
        from agent.agent import make_executor

        mock_llm = MagicMock()
        mock_executor = MagicMock()

        with patch("agent.agent.create_react_agent", return_value=MagicMock()), \
             patch("agent.agent.AgentExecutor", return_value=mock_executor):
            result = make_executor(mock_llm)

        assert result is mock_executor


class TestRunAgent:

    def test_returns_string_on_success(self):
        from agent.agent import run_agent

        mock_executor = MagicMock()
        mock_executor.invoke.return_value = {"output": "AAPL VaR is -2.3%"}

        result = run_agent(mock_executor, "What is the VaR for AAPL?")

        assert result == "AAPL VaR is -2.3%"

    def test_returns_error_string_never_raises(self):
        from agent.agent import run_agent

        mock_executor = MagicMock()
        mock_executor.invoke.side_effect = RuntimeError("LLM timeout")

        result = run_agent(mock_executor, "What is the VaR for AAPL?")

        assert "Error" in result
        assert "LLM timeout" in result

    def test_handles_missing_output_key(self):
        from agent.agent import run_agent

        mock_executor = MagicMock()
        mock_executor.invoke.return_value = {"something_else": "value"}

        result = run_agent(mock_executor, "query")

        assert isinstance(result, str)
