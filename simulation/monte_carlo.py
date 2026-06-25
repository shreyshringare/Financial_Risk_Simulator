import numpy as np
import pandas as pd


def run_monte_carlo(prices: pd.Series, days: int = 252, simulations: int = 1000, seed: int = 42) -> np.ndarray:
    """
    Run vectorized GBM Monte Carlo simulation.

    Args:
        prices: Historical price Series
        days: Number of days to simulate
        simulations: Number of simulation paths
        seed: Random seed for reproducibility

    Returns:
        np.ndarray of shape (simulations, days) — price paths
    """
    np.random.seed(seed)
    log_returns = np.log(prices / prices.shift(1)).dropna()
    mu = log_returns.mean()
    sigma = log_returns.std()
    last_price = prices.iloc[-1]

    dt = 1 / 252
    Z = np.random.normal(size=(simulations, days))
    daily_returns = np.exp((mu - 0.5 * sigma ** 2) * dt + sigma * np.sqrt(dt) * Z)
    price_paths = last_price * np.cumprod(daily_returns, axis=1)

    return price_paths
