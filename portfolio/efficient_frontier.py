"""
Markowitz Efficient Frontier via Monte Carlo portfolio simulation.
Generates random portfolio weight combinations to trace the efficient frontier.
No optimization library required — Monte Carlo approach.
"""
import numpy as np
import pandas as pd
from typing import Tuple, Dict, List


def compute_efficient_frontier(
    prices_df: pd.DataFrame,
    n_portfolios: int = 5000,
    risk_free_rate: float = 0.02,
    seed: int = 42
) -> pd.DataFrame:
    """
    Generate efficient frontier via Monte Carlo random portfolio sampling.

    Args:
        prices_df: Multi-ticker price DataFrame (dates x tickers)
        n_portfolios: Number of random portfolios to simulate
        risk_free_rate: Annual risk-free rate for Sharpe calculation
        seed: Random seed for reproducibility

    Returns:
        DataFrame with columns: weights_{ticker}..., expected_return, volatility, sharpe_ratio
        Sorted by volatility ascending.
    """
    np.random.seed(seed)
    # Step 1: Daily log returns
    log_returns = np.log(prices_df / prices_df.shift(1)).dropna()

    # Step 2: Annualised statistics
    mean_returns = log_returns.mean() * 252
    cov_matrix = log_returns.cov() * 252

    tickers = list(prices_df.columns)
    n_tickers = len(tickers)

    # Step 3: Monte Carlo simulation
    results = []
    for _ in range(n_portfolios):
        # Random weights, normalised to sum to 1
        w = np.random.random(n_tickers)
        w /= w.sum()

        port_return = np.dot(w, mean_returns)
        port_vol = np.sqrt(w.T @ cov_matrix.values @ w)
        sharpe = (port_return - risk_free_rate) / port_vol

        row = list(w) + [port_return, port_vol, sharpe]
        results.append(row)

    # Step 4: Build DataFrame
    weight_cols = [f"weight_{ticker}" for ticker in tickers]
    columns = weight_cols + ["expected_return", "volatility", "sharpe_ratio"]
    frontier_df = pd.DataFrame(results, columns=columns)

    return frontier_df.sort_values("volatility", ascending=True).reset_index(drop=True)


def find_optimal_portfolios(frontier_df: pd.DataFrame) -> Dict:
    """
    Find key portfolios on the efficient frontier.

    Returns dict with:
    - max_sharpe: row with highest Sharpe ratio
    - min_variance: row with lowest volatility
    - max_return: row with highest expected return

    Each value is a dict with: weights (dict ticker->weight), expected_return, volatility, sharpe_ratio
    """
    weight_cols = [c for c in frontier_df.columns if c.startswith("weight_")]

    def _extract(row: pd.Series) -> Dict:
        weights = {col.replace("weight_", ""): float(row[col]) for col in weight_cols}
        return {
            "weights": weights,
            "expected_return": float(row["expected_return"]),
            "volatility": float(row["volatility"]),
            "sharpe_ratio": float(row["sharpe_ratio"]),
        }

    max_sharpe_row = frontier_df.loc[frontier_df["sharpe_ratio"].idxmax()]
    min_variance_row = frontier_df.loc[frontier_df["volatility"].idxmin()]
    max_return_row = frontier_df.loc[frontier_df["expected_return"].idxmax()]

    return {
        "max_sharpe": _extract(max_sharpe_row),
        "min_variance": _extract(min_variance_row),
        "max_return": _extract(max_return_row),
    }


def frontier_to_dict(frontier_df: pd.DataFrame, sample_n: int = 200) -> Dict:
    """
    Convert frontier DataFrame to a JSON-serializable dict for agent/API consumption.
    Samples n rows evenly for size efficiency.

    Returns:
        {
          "n_portfolios_simulated": int,
          "tickers": list,
          "frontier_sample": [{"return": float, "volatility": float, "sharpe": float}, ...],
          "optimal": {result from find_optimal_portfolios}
        }
    """
    n_total = len(frontier_df)
    step = max(1, n_total // sample_n)
    sample = frontier_df.iloc[::step]

    weight_cols = [c for c in frontier_df.columns if c.startswith("weight_")]
    tickers = [c.replace("weight_", "") for c in weight_cols]

    frontier_sample = [
        {
            "return": round(float(row["expected_return"]), 4),
            "volatility": round(float(row["volatility"]), 4),
            "sharpe": round(float(row["sharpe_ratio"]), 4),
        }
        for _, row in sample.iterrows()
    ]

    optimal = find_optimal_portfolios(frontier_df)
    # Round floats in optimal
    for key, portfolio in optimal.items():
        portfolio["expected_return"] = round(portfolio["expected_return"], 4)
        portfolio["volatility"] = round(portfolio["volatility"], 4)
        portfolio["sharpe_ratio"] = round(portfolio["sharpe_ratio"], 4)
        portfolio["weights"] = {t: round(w, 4) for t, w in portfolio["weights"].items()}

    return {
        "n_portfolios_simulated": n_total,
        "tickers": tickers,
        "frontier_sample": frontier_sample,
        "optimal": optimal,
    }
