# Codebase Concerns

## Critical

### PATH-01 — Path Traversal in Export Filenames
`ticker` flows raw into `os.path.join(output_dir, f"{ticker}_risk_report_{timestamp}.xlsx")` in:
- `export/excel_exporter.py` (all 1 output file path)
- `export/powerbi_exporter.py` (6 output file paths: prices, risk_metrics, mc_summary, mc_percentiles, stress_tests, correlation)

A ticker value of `../../etc/foo` writes files outside `./reports/` or `./powerbi_data/`. No sanitization at any layer.

### PATH-02 — No Ticker Validation at API Boundary
`api/main.py:97-99` — `ChatRequest` only validates `message: str` and `history: list[dict]`. The ticker is extracted from free-text by the LLM, never validated as a field before hitting tool functions.

---

## High

### SEC-01 — Excel Formula Injection
`export/excel_exporter.py:336-356` (correlation sheet) — `c.value = t` writes the ticker string directly as a cell header with no prefix. A ticker of `=SYSTEM(...)` or `=HYPERLINK(...)` would be interpreted as a formula by Excel on open.

### CORRECT-01 — VaR/CVaR Mislabeled
`simulation/risk_metrics.py:6-37` — `calculate_var` and `calculate_cvar` operate on GBM Monte Carlo simulated terminal returns. This is **simulation-based (GBM) VaR**, not historical simulation VaR. GBM assumes log-normal returns, smoothing fat tails and volatility clustering. The distinction is material for risk reporting.

### CORRECT-02 — Export Numbers Differ from Screen
`agent/tools.py:184-192` — `export_analysis_report` calls `yf.download()` fresh and `run_monte_carlo()` fresh with no seed. The VaR/CVaR values in the exported Excel/CSV will differ from the numbers shown in the chat session.

### PERF-01 — No Groq API Timeout
`agent/agent.py:27-33` — `ChatGroq(...)` created with no `timeout` or `request_timeout` parameter. A Groq API stall (429, TCP hang) causes the SSE stream to hang indefinitely. `on_chain_error` only fires on Python exceptions, not TCP-level stalls.

### DEPLOY-01 — Hardcoded localhost in Frontend
`frontend/src/lib/sseClient.ts:3` — `const API_BASE = "http://localhost:8000"` is hardcoded. Deploying the Next.js frontend to any host requires a code change. No `NEXT_PUBLIC_API_URL` environment variable support.

---

## Medium

### CORRECT-03 — Non-Reproducible Results (No Seed)
`simulation/monte_carlo.py:23` — `np.random.normal(size=(simulations, days))` with no `np.random.seed()`. `portfolio/efficient_frontier.py` also uses `np.random.random()` unseeded. Every run produces different VaR, CVaR, and "optimal portfolio" weights. The efficient frontier max-Sharpe portfolio can vary ±10-15pp on individual weights between runs.

### CORRECT-04 — Hardcoded Data Window
`start="2020-01-01"` hardcoded in 5 tool functions:
- `agent/tools.py:55` (`run_monte_carlo_simulation`)
- `agent/tools.py:76` (`calculate_risk_metrics`)
- `agent/tools.py:168` (`run_stress_test_tool`)
- `agent/tools.py:184` (`export_analysis_report`)

Always fetches from Jan 2020 regardless of current date. Window shrinks relative to present as time passes.

### ARCH-01 — Mid-Stream Disconnect Leaks Server Tasks
`api/main.py:108-124` — `asyncio.create_task(run())` has no cancellation. Client refresh/disconnect kills the SSE connection but the agent task runs to completion, consuming Groq quota and threadpool slots.

### ARCH-02 — Vectorstore Init Race Condition
`agent/tools.py:23-29` — `_vectorstore` is a module-level global initialized lazily via `get_vectorstore()`. No lock around initialization. Concurrent first calls to `rag_financial_query` can trigger double-initialization of ChromaDB.

### ARCH-03 — LangSmith Hub Network Call at Startup
`agent/agent.py:54-85` — `hub.pull("hwchase17/react")` makes a network call during startup lifespan. Falls back to manual prompt on exception, but the fallback prompt may diverge behaviorally from the hub version silently.

### ARCH-04 — Dual UI with Stale Streamlit App
`app.py` (15KB Streamlit) coexists with the Next.js + FastAPI stack. `app.py` hardcodes `"GPT-4o"` as the model display name in HTML regardless of which model is actually running (Groq/Llama by default). Two UIs, no shared state, no clear deprecation path.

---

## Low

### BUG-01 — PowerBI Exporter Wrong Metric Keys
`export/powerbi_exporter.py` — The function signature accepts `risk_metrics: dict` but internally accesses keys `var_95`, `cvar_95` etc. The `export_analysis_report` tool at `tools.py:187-193` passes a dict with keys `var`, `cvar`, `sharpe`, `max_drawdown`. Key mismatch → `NaN` values in every PowerBI export.

### PERF-02 — Redundant yfinance Downloads
A single "analyze AAPL" agent run may trigger 2-3 separate `yf.download("AAPL", ...)` calls (from `fetch_stock_data`, `calculate_risk_metrics`, and potentially `run_monte_carlo_simulation`). No caching layer within a session.

### SEC-02 — No API Key Rotation Policy
`.env` contains a live Groq API key. No rotation documentation, no expiry enforcement. Key was exposed in a diagnostic tool run (recommend rotation).

### DEPLOY-02 — CORS Locked to localhost
`api/main.py` — `allow_origins` hardcoded to `["http://localhost:3000"]`. Any deployment requires code change.
