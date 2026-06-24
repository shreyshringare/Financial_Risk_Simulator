import os
import json
import numpy as np
import pandas as pd
import yfinance as yf
from langchain.tools import tool
from dotenv import load_dotenv

load_dotenv()

from simulation.monte_carlo import run_monte_carlo
from simulation.risk_metrics import calculate_var, calculate_cvar, calculate_sharpe, calculate_max_drawdown
from rag.knowledge_base import get_or_create_knowledge_base, query_knowledge_base
from portfolio.correlation import fetch_portfolio_data, calculate_correlation_matrix, calculate_portfolio_var
from simulation.stress_test import run_stress_test, get_available_scenarios, SCENARIOS
from r_analysis.garch_bridge import fit_garch
from export.excel_exporter import export_risk_report
from export.powerbi_exporter import export_for_powerbi
from news.rss_feed import fetch_ticker_news, fetch_market_headlines, format_news_for_agent, get_news_sentiment_keywords
from portfolio.efficient_frontier import compute_efficient_frontier, find_optimal_portfolios, frontier_to_dict
from data.market_data import fetch_prices, get_data_source_status

_vectorstore = None

def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = get_or_create_knowledge_base()
    return _vectorstore


@tool
def fetch_stock_data(ticker: str, start: str = "2020-01-01") -> str:
    """Fetch historical stock price data for a ticker symbol. Use ticker suffixes for global markets: .NS (NSE India), .L (LSE), .TO (TSX). Returns price statistics as JSON string."""
    try:
        data = yf.download(ticker, start=start, progress=False)
        prices = data['Close'].squeeze()
        return json.dumps({
            "ticker": ticker,
            "start": str(prices.index.min().date()),
            "end": str(prices.index.max().date()),
            "count": len(prices),
            "latest_price": round(float(prices.iloc[-1]), 2),
            "min_price": round(float(prices.min()), 2),
            "max_price": round(float(prices.max()), 2),
        })
    except Exception as e:
        return json.dumps({"error": f"Could not fetch {ticker}: {str(e)}"})


@tool
def run_monte_carlo_simulation(ticker: str, days: int = 252, simulations: int = 1000) -> str:
    """Run Monte Carlo simulation for a stock. Returns simulation summary statistics as JSON string."""
    try:
        data = yf.download(ticker, start="2020-01-01", progress=False)
        prices = data['Close'].squeeze()
        paths = run_monte_carlo(prices, days, simulations)
        final_prices = paths[:, -1]
        return json.dumps({
            "ticker": ticker,
            "days": days,
            "simulations": simulations,
            "mean_final_price": round(float(np.mean(final_prices)), 2),
            "std_final_price": round(float(np.std(final_prices)), 2),
            "percentile_5": round(float(np.percentile(final_prices, 5)), 2),
            "percentile_95": round(float(np.percentile(final_prices, 95)), 2),
        })
    except Exception as e:
        return json.dumps({"error": f"Monte Carlo simulation failed for {ticker}: {str(e)}"})


@tool
def calculate_risk_metrics(ticker: str) -> str:
    """Calculate VaR, CVaR, Sharpe ratio, and max drawdown for a stock. Returns metrics as JSON string."""
    try:
        data = yf.download(ticker, start="2020-01-01", progress=False)
        prices = data['Close'].squeeze()
        paths = run_monte_carlo(prices, days=252, simulations=1000)
        var = calculate_var(paths)
        cvar = calculate_cvar(paths)
        sharpe = calculate_sharpe(prices)
        max_drawdown = calculate_max_drawdown(prices)
        return json.dumps({
            "var": round(float(var), 4),
            "cvar": round(float(cvar), 4),
            "sharpe": round(float(sharpe), 4),
            "max_drawdown": round(float(max_drawdown), 4),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def explain_risk(metrics_json: str) -> str:
    """Explain risk metrics in plain English. Input: JSON string with var, cvar, sharpe, max_drawdown keys. Returns plain English explanation."""
    metrics = json.loads(metrics_json)

    var = metrics["var"]
    cvar = metrics["cvar"]
    sharpe = metrics["sharpe"]
    max_drawdown = metrics["max_drawdown"]

    var_pct = abs(var) * 100
    cvar_pct = abs(cvar) * 100
    md_pct = abs(max_drawdown) * 100

    # Sharpe interpretation
    if sharpe > 2.0:
        sharpe_label = "excellent — the stock generates strong risk-adjusted returns"
    elif sharpe > 1.0:
        sharpe_label = "good — the stock is generating solid risk-adjusted returns"
    elif sharpe >= 0:
        sharpe_label = "modest — returns are positive but not particularly efficient relative to risk"
    else:
        sharpe_label = "poor — returns are below the risk-free rate after adjusting for risk"

    explanation = (
        f"Value at Risk (VaR): There is a 95% chance that daily losses will not exceed {var_pct:.2f}%. "
        f"Put differently, on only 1 in 20 trading days would you expect to lose more than this amount.\n\n"
        f"Conditional VaR (CVaR / Expected Shortfall): In the worst 5% of scenarios, the average loss is {cvar_pct:.2f}%. "
        f"CVaR is more conservative than VaR because it captures the average severity of tail losses beyond the VaR threshold — "
        f"not just where the tail begins, but how bad it gets.\n\n"
        f"Sharpe Ratio: {sharpe:.4f} — This is {sharpe_label}. "
        f"A Sharpe ratio above 1.0 is generally considered good; above 2.0 is excellent; below 0 means the investment underperforms the risk-free rate.\n\n"
        f"Maximum Drawdown: -{md_pct:.2f}%. This is the largest peak-to-trough decline in the historical price series. "
        f"It represents the worst loss an investor would have suffered if they bought at the peak and held through the trough.\n\n"
        f"Important caveat: These metrics are derived from a Geometric Brownian Motion (GBM) simulation, which assumes "
        f"log-normally distributed returns, constant volatility, and no sudden price jumps. "
        f"In reality, markets exhibit fat tails, volatility clustering, and regime changes — so actual tail losses may be worse than these numbers suggest."
    )

    return explanation


@tool
def rag_financial_query(query: str) -> str:
    """Query the financial knowledge base for concepts like VaR, CVaR, GBM, Sharpe ratio, drawdown. Returns relevant excerpts."""
    try:
        vs = get_vectorstore()
        result = query_knowledge_base(vs, query, k=3)
        return result
    except Exception as e:
        return f"Knowledge base query failed: {str(e)}"


@tool
def analyze_portfolio(tickers_csv: str) -> str:
    """Analyze portfolio correlation and multi-ticker risk. Input: comma-separated tickers (e.g. 'AAPL,MSFT,TSLA'). Returns correlation matrix and portfolio VaR as JSON."""
    try:
        tickers = [t.strip().upper() for t in tickers_csv.split(",")]
        portfolio_data = fetch_portfolio_data(tickers)
        correlation_matrix = calculate_correlation_matrix(portfolio_data)
        weights = [1.0 / len(tickers)] * len(tickers)
        portfolio_var = calculate_portfolio_var(portfolio_data, weights)
        return json.dumps({
            "tickers": tickers,
            "correlation_matrix": correlation_matrix.to_dict(),
            "portfolio_var": portfolio_var,
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def run_stress_test_tool(ticker: str, scenario: str = "2008_financial_crisis") -> str:
    """Run historical stress test on a stock. Scenarios: 2008_financial_crisis, covid_2020, dotcom_2000, russia_ukraine_2022, black_monday_1987. Returns stressed VaR vs baseline VaR as JSON."""
    try:
        data = yf.download(ticker, start="2020-01-01", progress=False)
        prices = data['Close'].squeeze()
        paths = run_monte_carlo(prices, simulations=1000, days=252)
        if scenario not in SCENARIOS:
            available = get_available_scenarios()
            return json.dumps({"error": f"Invalid scenario '{scenario}'", "available_scenarios": available})
        result = run_stress_test(paths, scenario)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def export_analysis_report(ticker: str, format: str = "excel") -> str:
    """Export risk analysis to Excel or PowerBI format. format: 'excel' or 'powerbi'. Returns file path(s) as JSON."""
    try:
        data = yf.download(ticker, start="2020-01-01", progress=False)
        prices = data['Close'].squeeze()
        paths = run_monte_carlo(prices, days=252, simulations=1000)
        metrics = {
            "var": round(float(calculate_var(paths)), 4),
            "cvar": round(float(calculate_cvar(paths)), 4),
            "sharpe": round(float(calculate_sharpe(prices)), 4),
            "max_drawdown": round(float(calculate_max_drawdown(prices)), 4),
        }
        from simulation.stress_test import compare_scenarios
        stress_df = compare_scenarios(paths)
        if format == "excel":
            path = export_risk_report(ticker, paths, metrics, stress_df)
            return json.dumps({"format": "excel", "file": path})
        elif format == "powerbi":
            file_dict = export_for_powerbi(ticker, prices, paths, metrics, stress_df)
            return json.dumps({"format": "powerbi", "files": file_dict})
        else:
            return json.dumps({"error": f"Unknown format '{format}'. Use 'excel' or 'powerbi'."})
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def get_financial_news(ticker: str) -> str:
    """Fetch latest financial news headlines for a stock ticker. Returns top 5 articles with titles, dates, summaries, and sentiment analysis (bullish/bearish/neutral)."""
    try:
        articles = fetch_ticker_news(ticker, max_articles=5)
        sentiment = get_news_sentiment_keywords(articles)
        news_text = format_news_for_agent(articles)
        sentiment_summary = (
            f"\n\nSentiment Summary:\n"
            f"  Bullish signals: {', '.join(sentiment.get('bullish', [])) or 'none'}\n"
            f"  Bearish signals: {', '.join(sentiment.get('bearish', [])) or 'none'}\n"
            f"  Neutral signals: {', '.join(sentiment.get('neutral', [])) or 'none'}"
        )
        return news_text + sentiment_summary
    except Exception as e:
        return f"Could not fetch news for {ticker}: {str(e)}"


@tool
def compute_efficient_frontier_tool(tickers_csv: str) -> str:
    """Compute Markowitz efficient frontier for a portfolio. Input: comma-separated tickers (e.g. 'AAPL,MSFT,TSLA'). Returns optimal portfolios (max Sharpe, min variance) with weights as JSON."""
    try:
        tickers = [t.strip().upper() for t in tickers_csv.split(",")]
        portfolio_data = fetch_portfolio_data(tickers)
        prices_df = portfolio_data if isinstance(portfolio_data, pd.DataFrame) else pd.DataFrame(portfolio_data)
        frontier_df = compute_efficient_frontier(prices_df, n_portfolios=3000)
        result = frontier_to_dict(frontier_df, sample_n=100)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": f"Efficient frontier computation failed: {str(e)}"})


@tool
def get_market_movers(category: str = "gainers") -> str:
    """Get today's top market movers. category: 'gainers', 'losers', or 'most-active'. Returns top stocks by price movement."""
    try:
        articles = fetch_market_headlines(max_articles=8)
        formatted = format_news_for_agent(articles)
        return f"Market Movers ({category}):\n\n{formatted}"
    except Exception as e:
        return f"Could not fetch market movers for category '{category}': {str(e)}"


ALL_TOOLS = [fetch_stock_data, run_monte_carlo_simulation, calculate_risk_metrics,
             explain_risk, rag_financial_query,
             analyze_portfolio, run_stress_test_tool, export_analysis_report,
             get_financial_news, compute_efficient_frontier_tool, get_market_movers]
