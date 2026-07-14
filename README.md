# FinSim — Agentic Financial Risk Analysis

**Institutional-grade risk analysis. In plain English.**

Ask a question. A LangChain ReAct agent (Groq Llama 3.3 70B) runs Monte Carlo simulations, VaR/CVaR, options pricing, portfolio optimization, and stress tests — then composes an analyst research note streamed live to your browser.

**[Live Demo](https://financial-risk-simulator-frontend.onrender.com)** &nbsp;·&nbsp; **[API](https://financial-risk-simulator-i5jq.onrender.com/api/health)** &nbsp;·&nbsp; **[GitHub](https://github.com/shreyshringare/Financial_Risk_Simulator)**

> Free tier — backend cold-starts in ~30s after idle. The UI shows "warming up…" automatically.

---

## What it does

Type a question in plain English. The agent decides which tools to run, executes them, and writes a structured research note — streamed token by token.

```
"What is the VaR for AAPL?"
"Price a $200 call on NVDA expiring in 90 days"
"Analyze a portfolio of AAPL, MSFT, TSLA"
"Stress test RELIANCE.NS against the 2008 crisis"
"Compute the efficient frontier for AAPL, GOOGL, MSFT"
"Export TSLA risk report to Excel"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser  (Next.js 16 · React 19 · TypeScript · Tailwind v4)   │
│                                                                  │
│  QueryBar ──► page.tsx (useReducer) ──► ReportArea              │
│               │  consumes SSE stream        │                   │
│               │                        section cards            │
└───────────────┼─────────────────────────────────────────────────┘
                │  POST /api/chat  →  Server-Sent Events
┌───────────────┼─────────────────────────────────────────────────┐
│  FastAPI  (uvicorn)                                              │
│               │                                                  │
│  AnalystCallbackHandler                                          │
│    on_tool_start  ──►  { type: "status",  tool, label }         │
│    on_tool_end    ──►  { type: "section", section, data }       │
│    on_llm_new_token ►  { type: "token",   token }  (post Final) │
│    on_chain_end   ──►  { type: "done" }                         │
└───────────────┼─────────────────────────────────────────────────┘
                │  ainvoke() + callbacks
┌───────────────┼─────────────────────────────────────────────────┐
│  LangChain ReAct AgentExecutor  (Groq llama-3.3-70b)            │
│                                                                  │
│  Thought → Action → Action Input → Observation → repeat         │
│                           │                                      │
│          ┌────────────────┴───────────────────────┐             │
│          │            Tool Router                  │             │
│          └─┬──────────┬──────────┬────────────────┘             │
│            │          │          │                               │
│     ┌──────▼──┐  ┌────▼────┐  ┌─▼──────────────┐              │
│     │  Data   │  │  Math   │  │    Research     │              │
│     │         │  │         │  │                 │              │
│     │yfinance │  │Monte    │  │ChromaDB RAG     │              │
│     │         │  │Carlo GBM│  │BAAI/bge embed   │              │
│     │RSS news │  │VaR/CVaR │  │                 │              │
│     │         │  │Sharpe   │  │Black-Scholes    │              │
│     │         │  │Drawdown │  │Greeks · IV      │              │
│     │         │  │Portfolio│  │                 │              │
│     │         │  │Frontier │  │Stress Tests ×5  │              │
│     │         │  │         │  │                 │              │
│     └─────────┘  └─────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                           │  file output
              ┌────────────┴────────────┐
              │  Excel (.xlsx)          │
              │  PowerBI CSVs (×6)      │
              └─────────────────────────┘
```

**SSE Event types streamed to the browser:**

```typescript
{ type: "status";  tool: string; label: string }      // agent reasoning step
{ type: "section"; section: SectionType; data: {...} } // structured card data
{ type: "token";   token: string }                     // verdict prose, streamed live
{ type: "error";   message: string }
{ type: "done" }
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Groq llama-3.3-70b-versatile (free, ~200 tok/s) |
| Agent | LangChain ReAct AgentExecutor |
| Backend | FastAPI + sse-starlette |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind v4 |
| Simulation | NumPy vectorized GBM Monte Carlo |
| Risk | VaR · CVaR · Sharpe · Max Drawdown |
| Portfolio | Cholesky correlated VaR · Markowitz frontier |
| Options | Black-Scholes · Delta · Gamma · Vega · Theta · Rho |
| Stress Tests | 2008 · COVID · Dot-com · Russia-Ukraine · Black Monday |
| RAG | ChromaDB + BAAI/bge-base-en-v1.5 (local, no API key) |
| News | feedparser — Google News · Reuters · MarketWatch |
| Export | openpyxl Excel (5 sheets + charts) · PowerBI CSVs |
| Markets | NYSE/NASDAQ · NSE India (.NS) · LSE (.L) · TSX (.TO) |

---

## Agent Tools

| Tool | What it does |
|------|-------------|
| `fetch_stock_data` | Historical prices, returns price stats |
| `run_monte_carlo_simulation` | GBM paths → P5 / mean / P95 |
| `calculate_risk_metrics` | VaR · CVaR · Sharpe · Max Drawdown |
| `analyze_portfolio` | Correlation matrix + portfolio VaR |
| `compute_efficient_frontier_tool` | Markowitz max-Sharpe / min-variance |
| `run_stress_test_tool` | Historical crisis shock simulation |
| `analyze_option` | Black-Scholes pricing + full Greeks |
| `get_financial_news` | RSS articles + keyword sentiment |
| `export_analysis_report` | Excel workbook or PowerBI CSV export |
| `rag_financial_query` | Local ChromaDB finance knowledge base |

---

## Stress Test Scenarios

| Scenario | Shock | Duration |
|----------|-------|----------|
| 2008 Financial Crisis | −55% | 370 days |
| COVID-19 Crash (2020) | −34% | 33 days |
| Dot-com Bust (2000–02) | −78% | 929 days |
| Russia-Ukraine War (2022) | −25% | 282 days |
| Black Monday (1987) | −22% | 1 day |

---

## Global Market Support

| Exchange | Suffix | Example |
|----------|--------|---------|
| NYSE / NASDAQ | *(none)* | `AAPL` · `TSLA` · `NVDA` |
| NSE India | `.NS` | `RELIANCE.NS` · `TCS.NS` |
| LSE | `.L` | `HSBA.L` · `BP.L` |
| TSX | `.TO` | `SHOP.TO` · `RY.TO` |

---

## Export

**Excel** — 5-sheet workbook: Summary · Monte Carlo Paths (line chart) · Return Distribution (bar chart) · Stress Tests · Correlation Matrix

**PowerBI** — 6 structured CSVs: `_prices` · `_risk_metrics` · `_monte_carlo_summary` · `_monte_carlo_percentiles` · `_stress_tests` · `_correlation` + schema doc

---

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 20.9+
- Groq API key (free) → [console.groq.com](https://console.groq.com)

### Install

```bash
git clone https://github.com/shreyshringare/Financial_Risk_Simulator.git
cd Financial_Risk_Simulator

# Backend
python -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

pip install -r requirements.txt

cp .env.example .env
# Edit .env → add GROQ_API_KEY=your-key-here

# Frontend
cd frontend
npm install
```

### Run

**Terminal 1 — backend:**
```bash
uvicorn api.main:app --reload --port 8000
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
# → http://localhost:3000
```

First run: ~60s to build ChromaDB (downloads BAAI/bge model + embeds 8 finance docs).
Subsequent runs: ~0.3s (cached to `./chroma_db/`).

### Optional: R + GARCH

```r
install.packages(c("rugarch", "jsonlite"))
```

Enables GARCH(1,1) volatility modeling. Falls back to EWMA (RiskMetrics λ=0.94) if R is unavailable.

---

## Deploy

One-command deploy via [Render Blueprint](https://render.com/docs/infrastructure-as-code) — `render.yaml` configures both services.

1. Fork this repo
2. Render dashboard → **New → Blueprint** → connect your fork
3. Set env vars:
   - `finsim-api` → `GROQ_API_KEY`, `ALLOWED_ORIGINS=https://financial-risk-simulator-frontend.onrender.com`
   - `finsim-frontend` → `NEXT_PUBLIC_API_URL=https://finsim-api.onrender.com`
4. Redeploy frontend after setting env vars (Next.js bakes them at build time)

---

## GBM Assumptions & Limitations

| Assumption | Reality |
|-----------|---------|
| Log-normal returns | Fat tails in real markets (kurtosis > 3) |
| Constant volatility | Volatility clusters — GARCH models this |
| No jumps | Black swan events cause discontinuous drops |
| Independent increments | Autocorrelation exists at high frequency |

CVaR always exceeds VaR: it is the *average* loss beyond the VaR threshold, not just the threshold. For fat-tailed distributions, CVaR better captures tail risk.

---

## Project Structure

```
Financial_Risk_Simulator/
├── api/
│   ├── main.py                # FastAPI app, SSE endpoint, rate limiting
│   └── callback_handler.py    # AnalystCallbackHandler — intercepts LangChain events
├── agent/
│   ├── agent.py               # LangChain ReAct AgentExecutor
│   ├── tools/                 # 10 @tool functions
│   └── prompts.py             # Financial analyst system prompt
├── simulation/
│   ├── monte_carlo.py         # Vectorized GBM (NumPy)
│   ├── risk_metrics.py        # VaR · CVaR · Sharpe · Drawdown
│   └── stress_test.py         # Historical crisis scenarios
├── portfolio/
│   ├── correlation.py         # Pearson + Cholesky portfolio VaR
│   └── efficient_frontier.py  # Markowitz frontier
├── rag/
│   └── knowledge_base.py      # ChromaDB + BAAI/bge-base-en-v1.5
├── r_analysis/
│   ├── garch_model.R          # GARCH(1,1) via rugarch
│   └── garch_bridge.py        # Python subprocess bridge + EWMA fallback
├── news/
│   └── rss_feed.py            # feedparser RSS + keyword sentiment
├── export/
│   ├── excel_exporter.py      # openpyxl 5-sheet workbook
│   └── powerbi_exporter.py    # Structured CSV PowerBI data model
├── frontend/
│   └── src/
│       ├── app/               # Next.js App Router pages
│       ├── components/        # Section cards, QueryBar, Sidebar
│       ├── lib/               # SSE client, suggestions
│       └── types/             # SSEEvent union · ReportSection discriminated union
├── render.yaml                # Render deploy blueprint
└── tests/                     # pytest unit tests
```

---

*Educational use only. Not financial advice. All figures are model outputs, not investment recommendations.*
