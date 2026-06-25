"""
PowerBI data export module.
Exports structured CSV datasets for PowerBI Desktop consumption.

PowerBI connection: Open PowerBI Desktop → Get Data → Text/CSV → select any file in output_dir.
For a full model: import all CSVs, then create relationships on 'ticker' and 'date' columns.
"""
import os
from datetime import datetime
from typing import Optional, List
import numpy as np
import pandas as pd


def export_for_powerbi(
    ticker: str,
    prices: pd.Series,
    simulated_paths: np.ndarray,
    risk_metrics: dict,
    stress_results: Optional[pd.DataFrame] = None,
    correlation_df: Optional[pd.DataFrame] = None,
    output_dir: str = "./powerbi_data"
) -> dict:
    """
    Export all analysis data as structured CSVs for PowerBI Desktop.

    Args:
        ticker:           Stock ticker symbol (e.g. "AAPL").
        prices:           Historical closing prices as a pd.Series with a DatetimeIndex.
        simulated_paths:  Monte Carlo paths array of shape (n_simulations, n_days).
        risk_metrics:     Dict with keys: var, cvar, sharpe, max_drawdown.
        stress_results:   Optional DataFrame of stress-test results.
        correlation_df:   Optional square correlation matrix DataFrame (tickers as index/columns).
        output_dir:       Directory where CSV files will be written.

    Returns:
        dict mapping dataset name → file path (all files created)
    """
    os.makedirs(output_dir, exist_ok=True)

    report_date = datetime.today().strftime("%Y-%m-%d")
    exported = {}

    # ------------------------------------------------------------------
    # 1. Prices table
    # ------------------------------------------------------------------
    log_returns = np.log(prices / prices.shift(1))

    prices_df = pd.DataFrame({
        "date": prices.index,
        "ticker": ticker,
        "close_price": prices.values,
        "log_return": log_returns.values,
        "rolling_30d_vol": log_returns.rolling(30).std() * np.sqrt(252),
        "rolling_90d_vol": log_returns.rolling(90).std() * np.sqrt(252),
    })

    prices_path = os.path.join(output_dir, os.path.basename(f"{ticker}_prices.csv"))
    prices_df.to_csv(prices_path, index=False)
    exported["prices"] = prices_path

    # ------------------------------------------------------------------
    # 2. Risk metrics table
    # ------------------------------------------------------------------
    metrics_rows = [
        {
            "ticker": ticker,
            "metric_name": "VaR_95",
            "value": risk_metrics.get("var", np.nan),
            "interpretation": "Maximum expected loss at 95% confidence",
            "report_date": report_date,
        },
        {
            "ticker": ticker,
            "metric_name": "CVaR_95",
            "value": risk_metrics.get("cvar", np.nan),
            "interpretation": "Average loss beyond VaR threshold",
            "report_date": report_date,
        },
        {
            "ticker": ticker,
            "metric_name": "Sharpe_Ratio",
            "value": risk_metrics.get("sharpe", np.nan),
            "interpretation": "Risk-adjusted return (>1.0 good)",
            "report_date": report_date,
        },
        {
            "ticker": ticker,
            "metric_name": "Max_Drawdown",
            "value": risk_metrics.get("max_drawdown", np.nan),
            "interpretation": "Largest peak-to-trough decline",
            "report_date": report_date,
        },
    ]

    risk_metrics_df = pd.DataFrame(metrics_rows)
    risk_metrics_path = os.path.join(output_dir, os.path.basename(f"{ticker}_risk_metrics.csv"))
    risk_metrics_df.to_csv(risk_metrics_path, index=False)
    exported["risk_metrics"] = risk_metrics_path

    # ------------------------------------------------------------------
    # 3. Monte Carlo summary table (one row per simulation)
    # ------------------------------------------------------------------
    initial_price = simulated_paths[:, 0]
    final_price = simulated_paths[:, -1]
    terminal_return_pct = (final_price / initial_price - 1) * 100

    percentile_buckets = (np.floor(
        pd.Series(terminal_return_pct).rank(pct=True) * 10
    ).clip(upper=9) * 10).astype(int)
    bucket_labels = percentile_buckets.apply(lambda x: f"{x}-{x + 10}")

    mc_summary_df = pd.DataFrame({
        "simulation_id": np.arange(simulated_paths.shape[0]),
        "initial_price": initial_price,
        "final_price": final_price,
        "terminal_return_pct": terminal_return_pct,
        "above_initial": final_price > initial_price,
        "percentile_bucket": bucket_labels.values,
    })

    mc_summary_path = os.path.join(output_dir, os.path.basename(f"{ticker}_monte_carlo_summary.csv"))
    mc_summary_df.to_csv(mc_summary_path, index=False)
    exported["monte_carlo_summary"] = mc_summary_path

    # ------------------------------------------------------------------
    # 4. Monte Carlo percentiles table (sampled every 5th day)
    # ------------------------------------------------------------------
    days = range(0, simulated_paths.shape[1], 5)
    percentile_rows = []
    for day in days:
        col = simulated_paths[:, day]
        percentile_rows.append({
            "day": day,
            "p5":  np.percentile(col, 5),
            "p10": np.percentile(col, 10),
            "p25": np.percentile(col, 25),
            "p50": np.percentile(col, 50),
            "p75": np.percentile(col, 75),
            "p90": np.percentile(col, 90),
            "p95": np.percentile(col, 95),
        })

    mc_percentiles_df = pd.DataFrame(percentile_rows)
    mc_percentiles_path = os.path.join(output_dir, os.path.basename(f"{ticker}_monte_carlo_percentiles.csv"))
    mc_percentiles_df.to_csv(mc_percentiles_path, index=False)
    exported["monte_carlo_percentiles"] = mc_percentiles_path

    # ------------------------------------------------------------------
    # 5. Stress tests table (optional)
    # ------------------------------------------------------------------
    if stress_results is not None:
        stress_df = stress_results.copy()
        stress_df["ticker"] = ticker
        stress_df["report_date"] = report_date
        stress_path = os.path.join(output_dir, os.path.basename(f"{ticker}_stress_tests.csv"))
        stress_df.to_csv(stress_path, index=False)
        exported["stress_tests"] = stress_path

    # ------------------------------------------------------------------
    # 6. Correlation table (optional) — melted to long format
    # ------------------------------------------------------------------
    if correlation_df is not None:
        corr_long = (
            correlation_df
            .reset_index()
            .melt(id_vars=correlation_df.index.name or "index", var_name="ticker_b", value_name="correlation")
            .rename(columns={correlation_df.index.name or "index": "ticker_a"})
        )

        def _strength(val: float) -> str:
            if val >= 0.7:
                return "High"
            if val >= 0.3:
                return "Medium"
            if val >= 0.0:
                return "Low"
            return "Negative"

        corr_long["strength"] = corr_long["correlation"].apply(_strength)
        corr_path = os.path.join(output_dir, os.path.basename(f"{ticker}_correlation.csv"))
        corr_long.to_csv(corr_path, index=False)
        exported["correlation"] = corr_path

    # ------------------------------------------------------------------
    # 7. PowerBI schema documentation
    # ------------------------------------------------------------------
    stress_row = (
        f"| {ticker}_stress_tests.csv | scenario | Bar chart comparing stressed VaR |"
        if stress_results is not None
        else f"| {ticker}_stress_tests.csv | scenario | *(not generated — no stress data provided)* |"
    )
    correlation_row = (
        f"| {ticker}_correlation.csv | ticker_a, ticker_b | Matrix visual, heatmap |"
        if correlation_df is not None
        else f"| {ticker}_correlation.csv | ticker_a, ticker_b | *(not generated — no correlation data provided)* |"
    )

    schema_content = f"""# PowerBI Data Model Schema for Financial Risk Simulator

## How to Import
1. Open PowerBI Desktop
2. Home → Get Data → Text/CSV
3. Import each CSV file
4. Create relationships: join on `ticker` column across tables

## Tables
| File | Key Columns | Use |
|------|-------------|-----|
| {ticker}_prices.csv | date, ticker | Time series line charts, volatility trends |
| {ticker}_risk_metrics.csv | ticker, metric_name | KPI cards, metric comparisons |
| {ticker}_monte_carlo_summary.csv | simulation_id | Distribution histograms, scatter plots |
| {ticker}_monte_carlo_percentiles.csv | day | Fan chart (cone of uncertainty) |
{stress_row}
{correlation_row}

## Recommended Visuals
- **KPI Cards**: VaR, CVaR, Sharpe (from risk_metrics table)
- **Fan Chart**: p5/p25/p50/p75/p95 lines from monte_carlo_percentiles
- **Histogram**: terminal_return_pct from monte_carlo_summary
- **Heatmap**: correlation table using Matrix visual
- **Waterfall**: stress test shocked VaR vs baseline
"""

    schema_path = os.path.join(output_dir, "powerbi_schema.md")
    with open(schema_path, "w", encoding="utf-8") as f:
        f.write(schema_content)
    exported["schema"] = schema_path

    return exported
