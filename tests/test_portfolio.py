import numpy as np
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock


def _make_prices():
    np.random.seed(42)
    prices = pd.DataFrame({
        "AAPL": 150 + np.cumsum(np.random.randn(100)),
        "MSFT": 300 + np.cumsum(np.random.randn(100)),
        "TSLA": 200 + np.cumsum(np.random.randn(100)),
    })
    return prices


def test_correlation_matrix_shape():
    from portfolio.correlation import calculate_correlation_matrix

    prices = _make_prices()
    result = calculate_correlation_matrix(prices)

    assert result.shape == (3, 3)

    # All diagonal values must be 1.0
    for i in range(3):
        assert result.iloc[i, i] == 1.0

    # All values must be between -1.0 and 1.0
    assert (result.values >= -1.0).all()
    assert (result.values <= 1.0).all()


def test_portfolio_var_equal_weights():
    from portfolio.correlation import calculate_portfolio_var

    prices = _make_prices()
    result = calculate_portfolio_var(prices, weights=None)

    assert isinstance(result, dict)

    required_keys = {"portfolio_var", "portfolio_cvar", "diversification_ratio", "tickers", "weights"}
    assert required_keys.issubset(result.keys())

    # Loss is negative
    assert result["portfolio_var"] < 0

    # CVaR must be more negative (worse) than VaR
    assert result["portfolio_cvar"] <= result["portfolio_var"]

    # Weights: 3 assets, sum to 1
    assert len(result["weights"]) == 3
    assert abs(sum(result["weights"]) - 1.0) < 0.001
