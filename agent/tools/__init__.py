# agent/tools/__init__.py
from agent.tools.base import (
    _sanitize_ticker,
    fetch_stock_data,
    run_monte_carlo_simulation,
    calculate_risk_metrics,
    explain_risk,
    rag_financial_query,
    analyze_portfolio,
    run_stress_test_tool,
    export_analysis_report,
    get_financial_news,
    compute_efficient_frontier_tool,
    get_market_movers,
)
from agent.tools.options import analyze_option  # NEW

ALL_TOOLS = [
    fetch_stock_data, run_monte_carlo_simulation, calculate_risk_metrics,
    explain_risk, rag_financial_query,
    analyze_portfolio, run_stress_test_tool, export_analysis_report,
    get_financial_news, compute_efficient_frontier_tool, get_market_movers,
    analyze_option,  # NEW
]

__all__ = [
    "_sanitize_ticker",
    "fetch_stock_data", "run_monte_carlo_simulation", "calculate_risk_metrics",
    "explain_risk", "rag_financial_query",
    "analyze_portfolio", "run_stress_test_tool", "export_analysis_report",
    "get_financial_news", "compute_efficient_frontier_tool", "get_market_movers",
    "analyze_option",
    "ALL_TOOLS",
]
