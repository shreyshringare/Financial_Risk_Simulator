import json
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from agent.tools import fetch_stock_data, calculate_risk_metrics


def test_sanitize_ticker_valid():
    from agent.tools import _sanitize_ticker
    assert _sanitize_ticker("aapl") == "AAPL"
    assert _sanitize_ticker(" msft ") == "MSFT"
    assert _sanitize_ticker("^GSPC") == "^GSPC"
    assert _sanitize_ticker("TCS.NS") == "TCS.NS"
    assert _sanitize_ticker("VODAFONE.L") == "VODAFONE.L"


def test_sanitize_ticker_invalid():
    from agent.tools import _sanitize_ticker
    with pytest.raises(ValueError):
        _sanitize_ticker("../../etc/passwd")
    with pytest.raises(ValueError):
        _sanitize_ticker("")
    with pytest.raises(ValueError):
        _sanitize_ticker("A" * 13)
    with pytest.raises(ValueError):
        _sanitize_ticker("AAPL; DROP TABLE")


def test_yfinance_error_dict():
    with patch("agent.tools.base.fetch_prices", side_effect=Exception("Network error")):
        result = fetch_stock_data.func("ZZZZZ")
    parsed = json.loads(result)
    assert "error" in parsed


def test_risk_dict_keys():
    prices = pd.Series([100.0 + i for i in range(252)], name="Close")

    with patch("agent.tools.base.fetch_prices", return_value=prices), \
         patch("simulation.monte_carlo.run_monte_carlo", return_value=np.ones((100, 252)) * 100.0):
        result = calculate_risk_metrics.func("AAPL")

    parsed = json.loads(result)
    assert "var" in parsed
    assert "cvar" in parsed
    assert "sharpe" in parsed
    assert "max_drawdown" in parsed
    assert "var_99" in parsed
    assert "cvar_99" in parsed
    assert "volatility_annualized" in parsed
    assert "beta_spy" in parsed
    # beta computed vs SPY (same mocked prices series returned for both calls) -> ~1.0
    assert parsed["beta_spy"] == pytest.approx(1.0, abs=1e-3)


def test_risk_dict_beta_none_on_benchmark_failure():
    prices = pd.Series([100.0 + i for i in range(252)], name="Close")

    def fetch_side_effect(ticker, start=""):
        if ticker == "SPY":
            raise Exception("Network error")
        return prices

    with patch("agent.tools.base.fetch_prices", side_effect=fetch_side_effect), \
         patch("simulation.monte_carlo.run_monte_carlo", return_value=np.ones((100, 252)) * 100.0):
        result = calculate_risk_metrics.func("AAPL")

    parsed = json.loads(result)
    assert parsed["beta_spy"] is None


from datetime import date, timedelta

from agent.tools.base import _default_start


def test_default_start_is_rolling_five_years():
    before = date.today() - timedelta(days=5 * 365)
    result = _default_start()
    after = date.today() - timedelta(days=5 * 365)
    assert result in (before.isoformat(), after.isoformat())


def test_default_start_not_hardcoded_2020():
    assert _default_start() != "2020-01-01"
