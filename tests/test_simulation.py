import numpy as np
import pandas as pd
import pytest
from simulation.monte_carlo import run_monte_carlo
from simulation.risk_metrics import (
    calculate_var,
    calculate_sharpe,
    calculate_historical_var,
    calculate_historical_cvar,
    calculate_annualized_volatility,
    calculate_beta,
)


def test_monte_carlo_shape():
    prices = pd.Series([100.0 * (1.001 ** i) for i in range(252)])
    result = run_monte_carlo(prices, days=30, simulations=50)
    assert result.shape == (50, 30)


def test_var_negative():
    paths = np.array([[100.0, 80.0, 60.0]] * 100)
    result = calculate_var(paths)
    assert result < 0


def test_sharpe_zero_std():
    prices = pd.Series([100.0] * 100)
    result = calculate_sharpe(prices)
    assert result == 0.0


def test_historical_var_is_negative():
    np.random.seed(0)
    prices = pd.Series(100 * np.cumprod(1 + np.random.normal(0, 0.01, 500)))
    result = calculate_historical_var(prices)
    assert result < 0


def test_historical_cvar_more_negative_than_var():
    np.random.seed(0)
    prices = pd.Series(100 * np.cumprod(1 + np.random.normal(0, 0.01, 500)))
    var = calculate_historical_var(prices)
    cvar = calculate_historical_cvar(prices)
    assert cvar < var


def test_monte_carlo_seed_reproducible():
    prices = pd.Series([100.0 * (1.001 ** i) for i in range(252)])
    result1 = run_monte_carlo(prices, days=30, simulations=50, seed=42)
    result2 = run_monte_carlo(prices, days=30, simulations=50, seed=42)
    np.testing.assert_array_equal(result1, result2)


def test_historical_var_99_more_extreme_than_95():
    np.random.seed(0)
    prices = pd.Series(100 * np.cumprod(1 + np.random.normal(0, 0.01, 500)))
    var_95 = calculate_historical_var(prices, confidence=0.95)
    var_99 = calculate_historical_var(prices, confidence=0.99)
    # 99% VaR must be at least as extreme (<=, more negative) than 95% VaR
    assert var_99 <= var_95


def test_annualized_volatility_positive():
    np.random.seed(0)
    prices = pd.Series(100 * np.cumprod(1 + np.random.normal(0, 0.01, 500)))
    vol = calculate_annualized_volatility(prices)
    assert vol > 0


def test_beta_of_series_vs_itself_is_one():
    np.random.seed(0)
    prices = pd.Series(100 * np.cumprod(1 + np.random.normal(0, 0.01, 500)))
    beta = calculate_beta(prices, prices)
    assert beta == pytest.approx(1.0, abs=1e-6)
