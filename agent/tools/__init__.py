# agent/tools/__init__.py
# Re-exports everything so existing imports (from agent.tools import X) keep working.
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
    ALL_TOOLS,
)

__all__ = [
    "_sanitize_ticker",
    "fetch_stock_data",
    "run_monte_carlo_simulation",
    "calculate_risk_metrics",
    "explain_risk",
    "rag_financial_query",
    "analyze_portfolio",
    "run_stress_test_tool",
    "export_analysis_report",
    "get_financial_news",
    "compute_efficient_frontier_tool",
    "get_market_movers",
    "ALL_TOOLS",
]
