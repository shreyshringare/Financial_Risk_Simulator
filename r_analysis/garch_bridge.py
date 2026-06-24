"""
Python bridge to R GARCH(1,1) model.
Calls garch_model.R via subprocess (requires R + rugarch + jsonlite installed).
Falls back to a pure-Python EWMA volatility estimate if R is unavailable.
"""
import os
import json
import tempfile
import subprocess
import numpy as np
import pandas as pd
from pathlib import Path

R_SCRIPT_PATH = Path(__file__).parent / "garch_model.R"


def is_r_available() -> bool:
    """Check if Rscript is available on PATH."""
    try:
        result = subprocess.run(
            ["Rscript", "--version"],
            capture_output=True,
            timeout=10,
        )
        return result.returncode == 0
    except Exception:
        return False


def fit_garch_python_fallback(prices: pd.Series) -> dict:
    """
    Pure-Python EWMA volatility estimate (fallback when R unavailable).
    Not a true GARCH — uses exponentially weighted moving average (lambda=0.94, RiskMetrics method).
    """
    log_returns = np.log(prices / prices.shift(1)).dropna()

    lam = 0.94
    ewma_variance = np.zeros(len(log_returns))
    ewma_variance[0] = log_returns.iloc[:20].var()

    for t in range(1, len(log_returns)):
        ewma_variance[t] = lam * ewma_variance[t - 1] + (1 - lam) * log_returns.iloc[t - 1] ** 2

    current_vol_annualized = float(np.sqrt(ewma_variance[-1] * 252))

    return {
        "model": "EWMA (RiskMetrics, lambda=0.94) — R not available",
        "current_vol_annualized": current_vol_annualized,
        "note": "Install R + rugarch package for full GARCH(1,1) analysis",
        "r_available": False,
    }


def fit_garch(prices: pd.Series) -> dict:
    """
    Fit GARCH(1,1) model to price series.
    Uses R if available, falls back to Python EWMA otherwise.

    Args:
        prices: Historical price Series

    Returns:
        dict with model parameters and volatility forecast.
        Key 'r_available' indicates which path was taken.
    """
    if not is_r_available():
        result = fit_garch_python_fallback(prices)
        result["r_available"] = False
        return result

    tmp_csv = None
    tmp_json = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False
        ) as f:
            tmp_csv = f.name
            prices_df = prices.rename("Close")
            prices_df.to_csv(tmp_csv, index=False, header=True)

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            tmp_json = f.name

        proc = subprocess.run(
            ["Rscript", str(R_SCRIPT_PATH), tmp_csv, tmp_json],
            capture_output=True,
            timeout=120,
            text=True,
        )

        if proc.returncode != 0:
            result = fit_garch_python_fallback(prices)
            result["r_available"] = False
            result["r_error"] = proc.stderr
            return result

        with open(tmp_json, "r") as f:
            result = json.load(f)

        result["r_available"] = True
        return result

    finally:
        if tmp_csv and os.path.exists(tmp_csv):
            os.remove(tmp_csv)
        if tmp_json and os.path.exists(tmp_json):
            os.remove(tmp_json)
