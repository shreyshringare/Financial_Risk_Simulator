import json
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from agent.tools import fetch_stock_data, calculate_risk_metrics


def test_yfinance_error_dict():
    with patch("yfinance.download", side_effect=Exception("Network error")):
        result = fetch_stock_data.func("INVALIDTICKER_XYZ")
    parsed = json.loads(result)
    assert "error" in parsed


def test_risk_dict_keys():
    prices = pd.Series([100.0 + i for i in range(252)], name="Close")
    mock_df = pd.DataFrame({"Close": prices})

    with patch("yfinance.download", return_value=mock_df), \
         patch("simulation.monte_carlo.run_monte_carlo", return_value=np.ones((100, 252)) * 100.0):
        result = calculate_risk_metrics.func("AAPL")

    parsed = json.loads(result)
    assert "var" in parsed
    assert "cvar" in parsed
    assert "sharpe" in parsed
    assert "max_drawdown" in parsed
