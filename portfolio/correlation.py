"""
Portfolio correlation and multi-ticker risk analysis.
"""
import numpy as np
import pandas as pd
import yfinance as yf
from typing import List, Optional


def fetch_portfolio_data(tickers: List[str], start: str = "2020-01-01") -> pd.DataFrame:
    """
    Fetch historical Close prices for multiple tickers.

    Returns:
        DataFrame with tickers as columns, dates as index.
        Drops rows where ALL tickers have NaN. Forward-fills remaining NaN.
        On per-ticker error: fills that column with NaN and continues.
    """
    data = yf.download(tickers, start=start, progress=False)["Close"]

    if isinstance(data, pd.Series):
        data = data.to_frame()

    data = data.dropna(how="all").ffill()
    return data


def calculate_correlation_matrix(prices_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute Pearson correlation matrix of log returns.

    Returns:
        Correlation DataFrame (tickers x tickers), values rounded to 4 decimals.
    """
    log_returns = np.log(prices_df / prices_df.shift(1)).dropna()
    return log_returns.corr().round(4)


def calculate_portfolio_var(
    prices_df: pd.DataFrame,
    weights: Optional[List[float]] = None,
    simulations: int = 1000,
    days: int = 252,
    confidence: float = 0.95
) -> dict:
    """
    Portfolio-level Monte Carlo VaR using weighted simulation.

    Args:
        prices_df: Multi-ticker price DataFrame
        weights: Portfolio weights (must sum to 1). If None, equal-weight.
        simulations: Number of Monte Carlo paths
        days: Simulation horizon
        confidence: VaR confidence level

    Returns:
        dict with keys: tickers, weights, portfolio_var, portfolio_cvar,
        diversification_ratio (portfolio_vol / weighted_avg_individual_vol)
    """
    tickers = list(prices_df.columns)
    n_tickers = len(tickers)

    # Step 1: Equal weights if not provided
    if weights is None:
        weights = [1 / n_tickers] * n_tickers

    # Step 2: Normalize weights to sum to 1
    weights = np.array(weights, dtype=float)
    weights = weights / weights.sum()

    # Step 3: Compute log returns
    log_returns = np.log(prices_df / prices_df.shift(1)).dropna()

    # Step 4: Covariance matrix and Cholesky decomposition
    cov_matrix = log_returns.cov().values
    L = np.linalg.cholesky(cov_matrix)

    # Step 5: Generate correlated random draws and simulate paths
    mean_returns = log_returns.mean().values

    # Random draws shape: (simulations, days, n_tickers)
    draws = np.random.normal(size=(simulations, days, n_tickers))
    # Correlated draws: apply Cholesky
    correlated = draws @ L.T  # shape: (simulations, days, n_tickers)

    # Add mean returns to each day's correlated draws
    daily_log_returns = correlated + mean_returns  # broadcasting over (simulations, days)

    # Build cumulative price paths starting at 1.0
    # portfolio_paths shape: (simulations, days+1)
    initial_prices = np.ones((simulations, 1, n_tickers))
    price_paths = np.concatenate(
        [initial_prices, np.exp(np.cumsum(daily_log_returns, axis=1))],
        axis=1
    )  # shape: (simulations, days+1, n_tickers)

    # Step 5 (cont): Weighted portfolio value per simulation per day
    portfolio_paths = (price_paths * weights).sum(axis=2)  # shape: (simulations, days+1)

    # Step 6: Terminal portfolio returns
    terminal_returns = (portfolio_paths[:, -1] / portfolio_paths[:, 0]) - 1

    # Step 7: VaR
    var = np.percentile(terminal_returns, (1 - confidence) * 100)

    # Step 8: CVaR
    cvar = terminal_returns[terminal_returns <= var].mean()

    # Step 9: Diversification ratio (standard definition: DR > 1 = benefit from diversification)
    # Use consistent daily log-return std, scaled to full horizon by sqrt(days).
    individual_vols = log_returns.std().values * np.sqrt(days)
    portfolio_log_vol = np.std(np.log(portfolio_paths[:, -1] / portfolio_paths[:, 0]))
    weighted_avg_vol = weights @ individual_vols
    # DR = weighted_avg / portfolio: >1 means portfolio is less risky than naive weighted sum
    diversification_ratio = weighted_avg_vol / portfolio_log_vol if portfolio_log_vol > 1e-10 else np.nan

    return {
        "tickers": tickers,
        "weights": [round(float(w), 4) for w in weights],
        "portfolio_var": round(float(var), 4),
        "portfolio_cvar": round(float(cvar), 4),
        "diversification_ratio": round(float(diversification_ratio), 4),
    }
