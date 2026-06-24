# Financial Risk Simulator

> Agentic quantitative risk platform — Monte Carlo simulation, VaR/CVaR/Sharpe/drawdown, portfolio correlation, historical stress testing, GARCH(1,1) volatility modeling, and natural language interface via GPT-4o.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent | LangChain ReAct + GPT-4o (128K context) |
| Simulation | NumPy vectorized GBM Monte Carlo (1000 paths) |
| Risk Metrics | VaR, CVaR, Sharpe, Max Drawdown, Cholesky Portfolio VaR |
| Volatility | GARCH(1,1) via R/rugarch, EWMA fallback |
| Knowledge Base | ChromaDB RAG + OpenAI Embeddings (8 financial Wikipedia sources) |
| News | RSS financial news feed (Google News, Reuters, MarketWatch) |
| Data | yfinance + Selenium/BeautifulSoup fallback |
| Frontend | Streamlit chat UI |
| Export | openpyxl Excel (5-sheet workbook + charts), PowerBI CSV data model |
| Markets | US (NYSE/NASDAQ), NSE India (.NS), LSE (.L), TSX (.TO) |

## Features

### Core Risk Engine
- **Vectorized Monte Carlo GBM** — 1000 simulation paths using NumPy `cumprod`, no Python loops
- **VaR & CVaR** — 95% confidence, returned as loss percentages (negative convention)
- **Sharpe Ratio** — annualized, returns 0.0 on zero-std (no NaN/inf)
- **Max Drawdown** — rolling peak method via `prices / prices.cummax() - 1`

### Portfolio Analysis
- **Correlation Matrix** — Pearson correlation of log returns across multiple tickers
- **Portfolio VaR** — Cholesky decomposition of covariance matrix for correlated Monte Carlo paths
- **Diversification Ratio** — portfolio vol vs weighted average individual vols

### Stress Testing
5 historical crisis scenarios applied to simulated paths:
| Scenario | Shock | Duration |
|----------|-------|----------|
| 2008 Financial Crisis | -55% | 370 days |
| COVID-19 Crash (2020) | -34% | 33 days |
| Dot-com Bust (2000-02) | -78% | 929 days |
| Russia-Ukraine War (2022) | -25% | 282 days |
| Black Monday (1987) | -22% | 1 day |

### Volatility Modeling
- **GARCH(1,1)** via R `rugarch` package — persistence = α₁ + β₁, annualized unconditional vol, 10-day forecast
- **Python fallback** — RiskMetrics EWMA (λ=0.94) when R unavailable

### Natural Language Interface
GPT-4o ReAct agent with 8 domain tools:
| Tool | Purpose |
|------|---------|
| `fetch_stock_data` | Download historical prices via yfinance |
| `run_monte_carlo_simulation` | Run GBM paths, return percentile summary |
| `calculate_risk_metrics` | VaR, CVaR, Sharpe, max drawdown |
| `explain_risk` | Plain-English metric explanation (programmatic) |
| `rag_financial_query` | ChromaDB knowledge base query |
| `analyze_portfolio` | Multi-ticker correlation + portfolio VaR |
| `run_stress_test_tool` | Historical crisis stress testing |
| `export_analysis_report` | Excel workbook or PowerBI CSV export |

### Export
- **Excel**: 5-sheet formatted workbook — Summary, Monte Carlo Paths, Return Distribution, Stress Tests, Correlation Matrix
- **PowerBI**: 6 structured CSVs with auto-generated schema doc for direct PowerBI Desktop import

## Setup

### Prerequisites
- Python 3.10+
- OpenAI API key
- R + rugarch package (optional, for GARCH — falls back to Python EWMA)

### Installation

```bash
git clone https://github.com/shreyshringare/FinancialSim.git
cd FinancialSim
pip install -r requirements.txt
cp .env.example .env
# Edit .env → add your OPENAI_API_KEY
```

### Run

```bash
streamlit run app.py
```

First run: ~30 seconds (ChromaDB cold start — fetches + embeds 8 Wikipedia articles).  
Subsequent runs: ~0.3 seconds (cached).

### R Setup (optional, for GARCH)

```r
install.packages("rugarch")
install.packages("jsonlite")
```

## Usage Examples

Ask the agent in natural language:

```
"What is the 95% VaR for AAPL?"
"Run Monte Carlo simulation for RELIANCE.NS for 180 days"
"Analyze portfolio correlation for AAPL, MSFT, TSLA"
"Run 2008 financial crisis stress test on HSBA.L"
"Explain what CVaR means and why it's more conservative than VaR"
"Export TSLA risk report to Excel"
"What does GARCH tell us that GBM misses?"
```

## Global Market Support

Append exchange suffix to ticker:
- **NSE India**: `RELIANCE.NS`, `TCS.NS`, `INFY.NS`
- **LSE**: `HSBA.L`, `BP.L`, `SHEL.L`
- **TSX**: `SHOP.TO`, `RY.TO`, `TD.TO`
- **US**: `AAPL`, `MSFT`, `TSLA` (no suffix needed)

## Project Structure

```
FinancialSim/
├── app.py                     # Streamlit entry point
├── main.py                    # Standalone CLI (fixed yfinance bug)
├── agent/
│   ├── agent.py               # LangChain ReAct AgentExecutor (GPT-4o)
│   ├── tools.py               # 8 LangChain @tool functions
│   └── prompts.py             # Financial analyst system prompt
├── simulation/
│   ├── monte_carlo.py         # Vectorized GBM Monte Carlo
│   ├── risk_metrics.py        # VaR, CVaR, Sharpe, max drawdown
│   └── stress_test.py         # 5 historical crisis scenarios
├── portfolio/
│   ├── correlation.py         # Correlation matrix + portfolio VaR
│   └── efficient_frontier.py  # Markowitz efficient frontier
├── rag/
│   └── knowledge_base.py      # ChromaDB + OpenAI embeddings
├── r_analysis/
│   ├── garch_model.R          # GARCH(1,1) R script (rugarch)
│   └── garch_bridge.py        # Python subprocess bridge + EWMA fallback
├── news/
│   └── rss_feed.py            # Financial news RSS feed parser
├── data/
│   ├── market_data.py         # yfinance + fallback data layer
│   └── selenium_scraper.py    # Selenium-based web scraping automation
├── export/
│   ├── excel_exporter.py      # openpyxl 5-sheet report generator
│   └── powerbi_exporter.py    # Structured CSV PowerBI data model
└── tests/                     # 10+ pytest unit tests
```

## GBM Assumptions & Limitations

This simulator uses Geometric Brownian Motion. **Key assumptions (and where they break):**

| Assumption | Reality |
|-----------|---------|
| Log-normally distributed returns | Fat tails (kurtosis > 3) observed in real markets |
| Constant volatility | Volatility clusters (ARCH effect) — use GARCH for this |
| No jumps | Black swan events (2008, COVID) cause discontinuous price drops |
| Independent increments | Autocorrelation exists, especially at high frequency |

> CVaR is always more conservative than VaR: it is the *average* loss beyond the VaR threshold, not just the threshold value. For fat-tailed distributions, CVaR better captures tail risk.

## Disclaimer

For educational purposes only. Not financial advice.
