# Codebase Structure

## Directory Tree

```
FinancialSim/
├── api/
│   ├── __init__.py
│   └── main.py              # FastAPI app, /api/chat SSE endpoint, AnalystCallbackHandler
├── agent/
│   ├── __init__.py
│   ├── agent.py             # LLM selection (_build_llm), create_agent(), AgentExecutor
│   ├── prompts.py           # SYSTEM_PROMPT string
│   └── tools.py             # All 11 @tool definitions + ALL_TOOLS list
├── simulation/
│   ├── __init__.py
│   ├── monte_carlo.py       # run_monte_carlo() — GBM vectorized paths
│   ├── risk_metrics.py      # calculate_var, calculate_cvar, calculate_sharpe, calculate_max_drawdown
│   └── stress_test.py       # run_stress_test, SCENARIOS dict, compare_scenarios
├── portfolio/
│   ├── __init__.py
│   ├── correlation.py       # fetch_portfolio_data, calculate_correlation_matrix, calculate_portfolio_var
│   └── efficient_frontier.py # compute_efficient_frontier() — 5000-sample MC weight sampling
├── rag/
│   ├── __init__.py
│   └── knowledge_base.py    # get_or_create_knowledge_base(), query_knowledge_base() — ChromaDB + BAAI embeddings
├── data/
│   ├── __init__.py
│   ├── market_data.py       # fetch_prices() — yfinance → Stooq → BeautifulSoup fallback chain
│   └── selenium_scraper.py  # (unused in main path)
├── export/
│   ├── __init__.py
│   ├── excel_exporter.py    # export_risk_report() — multi-sheet openpyxl workbook
│   └── powerbi_exporter.py  # export_for_powerbi() — structured CSVs + schema doc
├── news/
│   ├── __init__.py
│   └── rss_feed.py          # fetch_ticker_news, fetch_market_headlines, sentiment keywords
├── r_analysis/
│   ├── __init__.py
│   └── garch_bridge.py      # fit_garch() — imported but NOT in ALL_TOOLS (dead in live path)
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx   # Root layout, fonts
│   │   │   └── page.tsx     # Main page — useReducer state, chat input, card rendering
│   │   ├── components/
│   │   │   ├── QueryBar.tsx         # Chat input bar
│   │   │   ├── ReportArea.tsx       # Card grid renderer
│   │   │   ├── Sidebar.tsx          # Left nav
│   │   │   └── cards/
│   │   │       ├── MonteCarloCard.tsx
│   │   │       ├── RiskCard.tsx
│   │   │       ├── StockCard.tsx
│   │   │       ├── VerdictCard.tsx
│   │   │       ├── CaveatsCard.tsx
│   │   │       └── ProseCard.tsx
│   │   ├── lib/
│   │   │   ├── sseClient.ts         # streamChat() async generator — POST + ReadableStream
│   │   │   └── riskUtils.ts         # Utility functions for risk display
│   │   └── types/
│   │       └── events.ts            # SSEEvent discriminated union type
│   ├── package.json         # Next.js 16, React 19, react-markdown, Tailwind 4
│   └── tailwind.config.ts
├── tests/
│   ├── test_api.py          # Health endpoint (1 test)
│   ├── test_tools.py        # fetch_stock_data error, calculate_risk_metrics shape (2 tests)
│   ├── test_portfolio.py    # Correlation, portfolio VaR (2 tests)
│   ├── test_simulation.py   # MC shape, VaR sign, Sharpe edge case (3 tests)
│   └── test_stress_test.py  # Scenarios, stress VaR, invalid scenario (3 tests)
├── chroma_db/               # Persisted ChromaDB vector store (on-disk, ~110MB)
├── app.py                   # Legacy Streamlit UI (15KB) — functional but parallel/stale
├── main.py                  # Streamlit entry point wrapper
├── requirements.txt         # Python dependencies
├── .env                     # GROQ_API_KEY (gitignored)
├── .env.example             # Template with documented keys
└── README.md
```

## Entry Points

### Current Stack (Next.js + FastAPI)
```bash
# Backend
uvicorn api.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm run dev   # → http://localhost:3000
```

### Legacy Stack (Streamlit)
```bash
streamlit run app.py         # → http://localhost:8501
# or
python main.py
```

## Parallel UI Situation

`app.py` is a complete 15KB Streamlit application with its own chat loop, sidebar, and export controls. It imports the same `agent/`, `simulation/`, `portfolio/` modules as the FastAPI backend.

The Next.js frontend + FastAPI (`api/main.py`) is the current active stack per README and recent commits (`8d5d1dd`). Both are runnable independently. `app.py` hardcodes `"GPT-4o"` as the model label in sidebar HTML regardless of which model is actually configured.

## Key File Roles

| File | Role |
|------|------|
| `api/main.py` | FastAPI app with lifespan (agent init), `/api/health`, `/api/chat` (SSE), CORS |
| `agent/agent.py` | `_build_llm()` (Groq/OpenAI selection), `create_agent()` (ReAct AgentExecutor) |
| `agent/tools.py` | All 11 `@tool` functions + `ALL_TOOLS = [...]` at line 250 |
| `simulation/monte_carlo.py` | `run_monte_carlo(prices, days=252, simulations=1000)` → `np.ndarray(sims, days)` |
| `portfolio/efficient_frontier.py` | `compute_efficient_frontier(prices_df, n_portfolios=5000)` → DataFrame |
| `rag/knowledge_base.py` | `get_or_create_knowledge_base()` (loads/creates ChromaDB), `query_knowledge_base(vs, query, k=3)` |
| `frontend/src/lib/sseClient.ts` | `streamChat(message, history)` async generator — single entry point for all frontend→backend comms |
| `frontend/src/types/events.ts` | `SSEEvent` discriminated union consumed by all card components |
