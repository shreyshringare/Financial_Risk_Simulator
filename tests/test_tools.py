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


from datetime import date, timedelta

from agent.tools.base import _default_start


def test_default_start_is_rolling_five_years():
    before = date.today() - timedelta(days=5 * 365)
    result = _default_start()
    after = date.today() - timedelta(days=5 * 365)
    assert result in (before.isoformat(), after.isoformat())


def test_default_start_not_hardcoded_2020():
    assert _default_start() != "2020-01-01"
