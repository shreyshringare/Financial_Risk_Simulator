import numpy as np
import pandas as pd
import pytest
from simulation.monte_carlo import run_monte_carlo
from simulation.risk_metrics import calculate_var, calculate_sharpe


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
