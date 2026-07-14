import numpy as np
import pandas as pd
from math import sqrt


def calculate_var(simulated_paths: np.ndarray, confidence: float = 0.95) -> float:
    """
    Calculate Value at Risk.

    Args:
        simulated_paths: shape (simulations, days) from monte_carlo.run_monte_carlo
        confidence: confidence level (default 0.95)

    Returns:
        VaR as negative float (loss percentage). E.g. -0.18 = 18% loss.
    """
    returns = simulated_paths[:, -1] / simulated_paths[:, 0] - 1
    var = np.percentile(returns, (1 - confidence) * 100)
    return float(var)


def calculate_cvar(simulated_paths: np.ndarray, confidence: float = 0.95) -> float:
    """
    Calculate Conditional VaR (Expected Shortfall).
    Always more negative than VaR.

    Args:
        simulated_paths: shape (simulations, days) from monte_carlo.run_monte_carlo
        confidence: confidence level (default 0.95)

    Returns:
        CVaR as negative float. More negative than VaR.
    """
    returns = simulated_paths[:, -1] / simulated_paths[:, 0] - 1
    var_threshold = np.percentile(returns, (1 - confidence) * 100)
    tail = returns[returns <= var_threshold]
    cvar = tail.mean() if len(tail) > 0 else var_threshold
    return float(cvar)


def calculate_sharpe(prices: pd.Series, risk_free_rate: float = 0.02) -> float:
    """
    Calculate annualized Sharpe ratio from price series.

    Args:
        prices: price series
        risk_free_rate: annual risk-free rate (default 0.02)

    Returns:
        Sharpe ratio. Returns 0.0 (not NaN/inf) if std == 0.
    """
    daily_returns = prices.pct_change().dropna()
    std = daily_returns.std()
    if std == 0:
        return 0.0
    daily_rf = risk_free_rate / 252
    excess_returns = daily_returns - daily_rf
    sharpe = (excess_returns.mean() * 252) / (std * sqrt(252))
    return float(sharpe)


def calculate_max_drawdown(prices: pd.Series) -> float:
    """
    Calculate maximum drawdown.

    Args:
        prices: price series

    Returns:
        Max drawdown as negative float. E.g. -0.35 = 35% drawdown.
    """
    drawdown = (prices / prices.cummax() - 1).min()
    return float(drawdown)


def calculate_historical_var(prices: pd.Series, confidence: float = 0.95) -> float:
    """
    Historical simulation VaR.
    Uses actual realized daily returns — no distributional assumption.
    Industry standard for equity risk.
    """
    returns = prices.pct_change().dropna()
    return float(np.percentile(returns, (1 - confidence) * 100))


def calculate_historical_cvar(prices: pd.Series, confidence: float = 0.95) -> float:
    """
    Historical simulation CVaR (Expected Shortfall).
    Mean of realized returns below the historical VaR threshold.
    """
    returns = prices.pct_change().dropna()
    threshold = calculate_historical_var(prices, confidence)
    tail = returns[returns <= threshold]
    return float(tail.mean() if len(tail) > 0 else threshold)


def calculate_annualized_volatility(prices: pd.Series) -> float:
    """
    Annualized volatility from daily returns.

    Args:
        prices: price series

    Returns:
        Annualized standard deviation of daily returns (pct_change), scaled by sqrt(252).
    """
    daily_returns = prices.pct_change().dropna()
    return float(daily_returns.std() * sqrt(252))


def calculate_beta(prices: pd.Series, benchmark_prices: pd.Series) -> float:
    """
    Calculate beta of an asset relative to a benchmark.

    Args:
        prices: asset price series
        benchmark_prices: benchmark price series (e.g. SPY)

    Returns:
        Beta = cov(asset_returns, benchmark_returns) / var(benchmark_returns),
        computed on aligned (overlapping) daily returns. Returns float("nan") if
        there is insufficient overlapping data or benchmark variance is 0.
    """
    asset_returns = prices.pct_change().dropna()
    bench_returns = benchmark_prices.pct_change().dropna()

    aligned = pd.concat([asset_returns, bench_returns], axis=1, join="inner").dropna()
    if aligned.shape[0] < 2:
        return float("nan")

    asset_aligned = aligned.iloc[:, 0]
    bench_aligned = aligned.iloc[:, 1]

    bench_var = bench_aligned.var()
    if bench_var == 0 or pd.isna(bench_var):
        return float("nan")

    covariance = asset_aligned.cov(bench_aligned)
    return float(covariance / bench_var)
