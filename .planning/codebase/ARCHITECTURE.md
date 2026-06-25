# Architecture

## System Overview

Dual-UI system: a legacy Streamlit app (`app.py`) and a current Next.js + FastAPI stack. Both target the same Python business logic but via different execution paths.

```
[User Browser]
    │ POST /api/chat (SSE)
    ▼
[FastAPI api/main.py :8000]
    │ ainvoke()
    ▼
[LangChain ReAct AgentExecutor]  ← shared singleton (app.state.agent_executor)
    │ selects tools
    ▼
[Tools: agent/tools.py]
    ├── fetch_stock_data → yfinance (sync, blocks event loop*)
    ├── run_monte_carlo_simulation → simulation/monte_carlo.py
    ├── calculate_risk_metrics → simulation/risk_metrics.py
    ├── rag_financial_query → rag/knowledge_base.py → ChromaDB
    ├── analyze_portfolio → portfolio/correlation.py
    ├── compute_efficient_frontier_tool → portfolio/efficient_frontier.py
    ├── run_stress_test_tool → simulation/stress_test.py
    ├── export_analysis_report → export/excel_exporter.py | powerbi_exporter.py
    ├── get_financial_news → news/rss_feed.py
    ├── explain_risk (pure function)
    └── get_market_movers → yfinance (sync)
    │
    ▼ tool outputs → AnalystCallbackHandler.queue
[AnalystCallbackHandler]  ← new instance per request (api/main.py:24)
    │ asyncio.Queue[str | None]
    ▼
[EventSourceResponse generator]
    │ SSE text/event-stream
    ▼
[Next.js sseClient.ts async generator]
    ▼
[React cards: MonteCarloCard, RiskCard, StockCard, VerdictCard, CaveatsCard, ProseCard]
```

*`yf.download()` is synchronous with no `run_in_executor` wrapper — blocks the event loop during downloads.

## State Management

| State | Scope | Location |
|-------|-------|----------|
| `agent_executor` | Process-wide singleton | `app.state.agent_executor` (lifespan, `api/main.py:69`) |
| `AnalystCallbackHandler` | Per-request | created in `chat()` handler, passed via `config={"callbacks": [...]}` |
| `_vectorstore` | Module-global, lazy | `agent/tools.py:23` — no lock, race condition on concurrent cold-start |
| Chat history | Client-side | `useReducer` in `frontend/src/app/page.tsx`, sent as `history: []` in POST body |

## SSE Event Types

All events are JSON objects. Defined in `frontend/src/types/events.ts`.

| type | When fired | Payload |
|------|-----------|---------|
| `token` | Every LLM output token | `{token: string}` |
| `section` | Tool completes successfully | `{section: "stock"|"monte_carlo"|"risk", data: object}` |
| `done` | Agent chain ends | (no extra fields) |
| `error` | Chain error or HTTP error | `{message: string}` |

Tool → section mapping (`api/main.py:16-20`):
- `fetch_stock_data` → `"stock"`
- `run_monte_carlo_simulation` → `"monte_carlo"`
- `calculate_risk_metrics` → `"risk"`
- All other tools: results go to LLM scratchpad only, no SSE section emitted

## LangChain Agent Setup (`agent/agent.py`)

- Model: `ChatGroq(model="llama-3.3-70b-versatile", temperature=0, max_tokens=2000, streaming=True)` if `GROQ_API_KEY` set; else `ChatOpenAI(model="gpt-4o-mini")`
- Prompt: attempts `hub.pull("hwchase17/react")` at startup; falls back to inline ReAct template
- Agent type: `create_react_agent` + `AgentExecutor(max_iterations=10, verbose=True)`
- 11 tools in `ALL_TOOLS` (`agent/tools.py:250`)

## Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `api/` | FastAPI app, SSE endpoint, CORS, `AnalystCallbackHandler` |
| `agent/` | LLM setup, ReAct agent, all `@tool` definitions, prompts |
| `simulation/` | GBM Monte Carlo, VaR/CVaR/Sharpe, stress testing |
| `portfolio/` | Correlation matrix, portfolio VaR, efficient frontier |
| `rag/` | ChromaDB knowledge base, HuggingFace embeddings, query |
| `data/` | Multi-source price fetcher (yfinance → Stooq → BeautifulSoup) |
| `export/` | Excel (openpyxl) and PowerBI (CSV) report generation |
| `news/` | RSS feed fetching, sentiment keyword extraction |
| `r_analysis/` | GARCH(1,1) bridge (imported but not in `ALL_TOOLS`) |
| `frontend/` | Next.js UI, SSE client, card components |
| `app.py` | Legacy Streamlit UI (15KB, still functional, parallel to above) |

## Async Model

FastAPI endpoint is `async def chat(...)`. Agent runs via `asyncio.create_task(run())`. SSE events drain from the queue concurrently. **However**: yfinance downloads inside tools are synchronous with no `run_in_executor` — they block the async event loop during execution. Under concurrent requests this degrades throughput.
