"""
Stress testing module. Applies historical market shock scenarios to simulated paths
to show how a position would perform under crisis conditions.
"""
import numpy as np
import pandas as pd
from typing import Dict, Any

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "2008_financial_crisis": {
        "shock": -0.55,
        "duration_days": 370,
        "description": "2008 Global Financial Crisis — S&P 500 fell ~55% peak-to-trough",
        "peak_year": 2007,
    },
    "covid_2020": {
        "shock": -0.34,
        "duration_days": 33,
        "description": "COVID-19 Crash (Feb–Mar 2020) — S&P 500 fell ~34% in 33 days",
        "peak_year": 2020,
    },
    "dotcom_2000": {
        "shock": -0.78,
        "duration_days": 929,
        "description": "Dot-com Bust (2000–2002) — NASDAQ fell ~78% peak-to-trough",
        "peak_year": 2000,
    },
    "russia_ukraine_2022": {
        "shock": -0.25,
        "duration_days": 282,
        "description": "Russia-Ukraine War + Fed hikes (2022) — S&P 500 fell ~25%",
        "peak_year": 2022,
    },
    "black_monday_1987": {
        "shock": -0.22,
        "duration_days": 1,
        "description": "Black Monday (Oct 19, 1987) — single-day S&P drop of ~22%",
        "peak_year": 1987,
    },
}


def get_available_scenarios() -> list:
    """
    Returns list of dicts: [{"name": str, "description": str, "shock": float}, ...]
    Sorted by shock magnitude (most severe first).
    """
    scenarios = [
        {
            "name": key,
            "description": val["description"],
            "shock": val["shock"],
        }
        for key, val in SCENARIOS.items()
    ]
    return sorted(scenarios, key=lambda s: s["shock"])


def run_stress_test(simulated_paths: np.ndarray, scenario: str) -> dict:
    """
    Apply a historical shock scenario to Monte Carlo simulation paths.

    Args:
        simulated_paths: shape (simulations, days) from monte_carlo.run_monte_carlo
        scenario: key from SCENARIOS dict

    Returns:
        dict with:
        - scenario_name: str
        - description: str
        - shock_applied: float (negative, e.g. -0.55)
        - baseline_var_95: float (VaR from original paths, negative)
        - stressed_var_95: float (VaR after shock applied, negative)
        - baseline_mean_return: float
        - stressed_mean_return: float
        - worst_case_loss: float (min terminal return after stress, negative)
        - pct_paths_total_loss: float (% paths with >50% loss after stress)

    Raises:
        ValueError if scenario not in SCENARIOS.
    """
    if scenario not in SCENARIOS:
        raise ValueError(
            f"Scenario '{scenario}' not found. Available scenarios: {list(SCENARIOS.keys())}"
        )

    scenario_data = SCENARIOS[scenario]
    shock = scenario_data["shock"]

    baseline_terminal_returns = (simulated_paths[:, -1] / simulated_paths[:, 0]) - 1
    stressed_returns = (1 + baseline_terminal_returns) * (1 + shock) - 1

    baseline_var_95 = np.percentile(baseline_terminal_returns, 5)
    stressed_var_95 = np.percentile(stressed_returns, 5)
    worst_case_loss = stressed_returns.min()
    pct_paths_total_loss = (stressed_returns < -0.5).mean() * 100

    return {
        "scenario_name": scenario,
        "description": scenario_data["description"],
        "shock_applied": round(float(shock), 4),
        "baseline_var_95": round(float(baseline_var_95), 4),
        "stressed_var_95": round(float(stressed_var_95), 4),
        "baseline_mean_return": round(float(baseline_terminal_returns.mean()), 4),
        "stressed_mean_return": round(float(stressed_returns.mean()), 4),
        "worst_case_loss": round(float(worst_case_loss), 4),
        "pct_paths_total_loss": round(float(pct_paths_total_loss), 4),
    }


def compare_scenarios(simulated_paths: np.ndarray) -> pd.DataFrame:
    """
    Run all scenarios and return comparison DataFrame.
    Columns: scenario, description, shock, stressed_var_95, worst_case_loss, pct_paths_total_loss
    Sorted by stressed_var_95 ascending (worst first).
    """
    rows = []
    for scenario_key in SCENARIOS:
        result = run_stress_test(simulated_paths, scenario_key)
        rows.append(
            {
                "scenario": result["scenario_name"],
                "description": result["description"],
                "shock": result["shock_applied"],
                "stressed_var_95": result["stressed_var_95"],
                "worst_case_loss": result["worst_case_loss"],
                "pct_paths_total_loss": result["pct_paths_total_loss"],
            }
        )

    df = pd.DataFrame(rows)
    return df.sort_values("stressed_var_95", ascending=True).reset_index(drop=True)
