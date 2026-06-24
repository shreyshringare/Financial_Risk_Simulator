# FinSim — Quantitative Risk Terminal

> Agentic financial risk platform with a phosphor terminal analyst UI. Natural language queries drive a LangChain ReAct agent (Groq llama-3.3-70b) that orchestrates Monte Carlo GBM simulation, VaR/CVaR/Sharpe/drawdown, Markowitz efficient frontier, historical stress testing, RSS news sentiment, and Excel/PowerBI export — streamed token-by-token to a Next.js analyst report UI.

**Built as a resume differentiator for JPMC CIB Research & Analytics internship.**

---

## Architecture

```
frontend/          Next.js 16 · React 19 · TypeScript · Tailwind v4
                   Phosphor terminal UI · localhost:3000
       ↕  POST /api/chat → SSE stream of typed events
api/               FastAPI · uvicorn · localhost:8000
                   AnalystCallbackHandler intercepts LangChain events
       ↕
agent/             LangChain ReAct AgentExecutor
                   Groq llama-3.3-70b-versatile (free tier, 70B params)
       ↕
simulation/  portfolio/  rag/  news/  data/  export/  r_analysis/
```

**SSE Event Protocol:**
```typescript
type SSEEvent =
  | { type: "section"; section: "stock" | "monte_carlo" | "risk" | "caveats"; data: {...} }
  | { type: "token"; token: string }   // streams verdict token-by-token
  | { type: "error"; message: string }
  | { type: "done" }
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Groq llama-3.3-70b-versatile (free 100K TPD, ~200 tok/s) |
| Agent | LangChain ReAct AgentExecutor |
| Backend | FastAPI + sse-starlette (SSE streaming) |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Simulation | NumPy vectorized GBM Monte Carlo (1,000 paths) |
| Risk Metrics | VaR, CVaR, Sharpe, Max Drawdown |
| Portfolio | Monte Carlo frontier (5,000 samples), Cholesky VaR |
| Volatility | GARCH(1,1) via R/rugarch, EWMA fallback |
| RAG | ChromaDB + BAAI/bge-base-en-v1.5 (local, no API key) |
| News | feedparser — Google News, Reuters, MarketWatch RSS |
| Data | yfinance + Selenium/BeautifulSoup fallback |
| Export | openpyxl Excel (5-sheet + charts), PowerBI CSVs |
| Markets | NYSE/NASDAQ, NSE India (.NS), LSE (.L), TSX (.TO) |
| Tests | pytest — 11 unit tests |

---

## Features

### Analyst Report UI (Phosphor Terminal)
- Amber phosphor glow on near-black (`#050505`) background
- VT323 font for headers/numbers, IBM Plex Mono for prose
- Scanline overlay + CRT edge vignette via CSS `body::before/after`
- Section cards "print in" with clip-path sweep animation
- Verdict card streams LLM tokens live with amber blinking cursor
- Risk badges: LOW (green glow), MODERATE (yellow glow), HIGH (red glow)

### Core Risk Engine
- **Vectorized Monte Carlo GBM** — 1,000 paths, NumPy `cumprod`, zero Python loops
- **VaR (95%)** — historical log-return simulation
- **CVaR** — average loss beyond VaR threshold (more conservative, better for fat tails)
- **Sharpe Ratio** — annualized, returns 0.0 on zero-std
- **Max Drawdown** — rolling peak method via `prices / prices.cummax() - 1`

### Portfolio Analysis
- **Correlation Matrix** — Pearson correlation of log returns
- **Portfolio VaR** — Cholesky decomposition for correlated Monte Carlo paths
- **Efficient Frontier** — 5,000 random weight samples, max-Sharpe + min-variance selection

### Stress Testing
5 historical crisis scenarios applied to simulated paths:

| Scenario | Shock | Duration |
|----------|-------|----------|
| 2008 Financial Crisis | −55% | 370 days |
| COVID-19 Crash (2020) | −34% | 33 days |
| Dot-com Bust (2000–02) | −78% | 929 days |
| Russia-Ukraine War (2022) | −25% | 282 days |
| Black Monday (1987) | −22% | 1 day |

### RAG Knowledge Base
- **BAAI/bge-base-en-v1.5** embeddings — top MTEB benchmark, runs fully locally (~110MB, no API key)
- **ChromaDB** persisted to `./chroma_db/`
- **8 sources**: Wikipedia articles on VaR, CVaR, GBM, Sharpe, Max Drawdown, Fat Tails, Volatility Clustering, Black-Scholes
- Cold start ~60s (scrape + embed). Subsequent loads ~0.3s from disk
- Triggered by conceptual queries: "Explain CVaR", "What are GBM assumptions?"

### Agent Tools
| Tool | Purpose |
|------|---------|
| `fetch_stock_data` | yfinance historical prices, returns price stats as JSON |
| `run_monte_carlo_simulation` | GBM paths, returns P5/mean/P95 |
| `calculate_risk_metrics` | VaR, CVaR, Sharpe, max drawdown |
| `explain_risk` | Programmatic plain-English metric explanation |
| `rag_financial_query` | ChromaDB similarity search (k=3) |
| `analyze_portfolio` | Multi-ticker correlation + portfolio VaR |
| `run_stress_test_tool` | Historical crisis stress testing |
| `export_analysis_report` | Excel workbook or PowerBI CSV export |
| `get_financial_news` | Google News RSS → top 5 articles + keyword sentiment |
| `compute_efficient_frontier_tool` | Markowitz frontier via Monte Carlo sampling |

### Export
- **Excel**: 5-sheet formatted workbook — Summary, Monte Carlo Paths (LineChart), Return Distribution (BarChart), Stress Tests, Correlation Matrix
- **PowerBI**: 6 structured CSVs (`_prices`, `_risk_metrics`, `_monte_carlo_summary`, `_monte_carlo_percentiles`, `_stress_tests`, `_correlation`) + auto-generated `powerbi_schema.md`

### Volatility Modeling
- **GARCH(1,1)** via R `rugarch` — persistence α₁+β₁, annualized unconditional vol, 10-day forecast
- **EWMA fallback** — RiskMetrics λ=0.94 when R unavailable

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API key (free — 100K tokens/day) → [console.groq.com](https://console.groq.com)

### Installation

```bash
git clone https://github.com/shreyshringare/Financial_Risk_Simulator.git
cd Financial_Risk_Simulator

# Python backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt   # Windows
# source venv/bin/activate && pip install -r requirements.txt  # Mac/Linux

# Copy env and add Groq key
cp .env.example .env
# Edit .env → GROQ_API_KEY=your-key-here

# Frontend
cd frontend
npm install
```

### Run

**Terminal 1 — Backend:**
```bash
cd Financial_Risk_Simulator
venv/Scripts/python -m uvicorn api.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd Financial_Risk_Simulator/frontend
npm run dev
# → http://localhost:3000
```

First run: ~60s ChromaDB cold start (downloads BAAI/bge model + embeds Wikipedia docs).  
Subsequent runs: ~0.3s (cached to `./chroma_db/`).

### R Setup (optional, for GARCH)

```r
install.packages("rugarch")
install.packages("jsonlite")
```

---

## Usage

```
"What is the 95% VaR for AAPL?"
"Give me a full risk analysis of TSLA"
"Run Monte Carlo simulation for RELIANCE.NS for 180 days"
"Analyze portfolio: AAPL, MSFT, TSLA"
"Run 2008 financial crisis stress test on HSBA.L"
"Explain what CVaR means"
"Efficient frontier for AAPL, GOOGL, MSFT"
"Latest news for NVDA"
"Export TSLA risk report to Excel"
```

---

## Global Market Support

| Exchange | Suffix | Example |
|----------|--------|---------|
| NYSE/NASDAQ | (none) | `AAPL`, `MSFT`, `TSLA` |
| NSE India | `.NS` | `RELIANCE.NS`, `TCS.NS` |
| LSE | `.L` | `HSBA.L`, `BP.L` |
| TSX | `.TO` | `SHOP.TO`, `RY.TO` |

---

## Project Structure

```
Financial_Risk_Simulator/
├── api/
│   └── main.py                # FastAPI app, SSE endpoint, AnalystCallbackHandler
├── agent/
│   ├── agent.py               # LangChain ReAct AgentExecutor (Groq llama-3.3-70b)
│   ├── tools.py               # 10 LangChain @tool functions
│   └── prompts.py             # Financial analyst system prompt
├── simulation/
│   ├── monte_carlo.py         # Vectorized GBM Monte Carlo (NumPy)
│   ├── risk_metrics.py        # VaR, CVaR, Sharpe, max drawdown
│   └── stress_test.py         # 5 historical crisis scenarios
├── portfolio/
│   ├── correlation.py         # Correlation matrix + Cholesky portfolio VaR
│   └── efficient_frontier.py  # Markowitz frontier via Monte Carlo sampling
├── rag/
│   └── knowledge_base.py      # ChromaDB + BAAI/bge-base-en-v1.5 (local)
├── r_analysis/
│   ├── garch_model.R          # GARCH(1,1) via rugarch
│   └── garch_bridge.py        # Python subprocess bridge + EWMA fallback
├── news/
│   └── rss_feed.py            # feedparser RSS + keyword sentiment
├── data/
│   ├── market_data.py         # yfinance + fallback data layer
│   └── selenium_scraper.py    # Selenium/BeautifulSoup scraping fallback
├── export/
│   ├── excel_exporter.py      # openpyxl 5-sheet workbook + charts
│   └── powerbi_exporter.py    # Structured CSV PowerBI data model
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx       # Terminal: useReducer SSE orchestration
│       │   ├── layout.tsx     # Root layout, VT323 + IBM Plex Mono fonts
│       │   └── globals.css    # Phosphor theme, scanlines, CRT, animations
│       ├── components/
│       │   ├── QueryBar.tsx   # Amber prompt input + RUN button
│       │   ├── Sidebar.tsx    # Quick queries, markets, capabilities
│       │   ├── ReportArea.tsx # Progressive section reveal
│       │   └── cards/         # StockCard, MonteCarloCard, RiskCard,
│       │                      # VerdictCard, CaveatsCard, ProseCard
│       ├── lib/
│       │   ├── sseClient.ts   # Async SSE line reader (AsyncGenerator)
│       │   └── riskUtils.ts   # riskLevel(), formatPct(), phosphor badge classes
│       └── types/
│           └── events.ts      # SSEEvent union type, ReportSection discriminated union
└── tests/                     # 11 pytest unit tests
```

---

## GBM Assumptions & Limitations

| Assumption | Reality |
|-----------|---------|
| Log-normally distributed returns | Fat tails (kurtosis > 3) in real markets |
| Constant volatility | Volatility clusters — use GARCH for this |
| No jumps | Black swan events cause discontinuous drops |
| Independent increments | Autocorrelation exists at high frequency |

> CVaR always exceeds VaR in severity: it is the *average* loss beyond the VaR threshold, not just the threshold. For fat-tailed distributions, CVaR better captures tail risk.

---

## Disclaimer

Educational use only. Not financial advice. All figures are simulated.
