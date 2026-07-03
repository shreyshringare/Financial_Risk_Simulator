# Codebase Concerns

## Medium

### ARCH-02 — Vectorstore Init Race Condition
`agent/tools/base.py:39-45` — `_vectorstore` is a module-level global initialized lazily via `get_vectorstore()`. No lock around initialization. Concurrent first calls to `rag_financial_query` can trigger double-initialization of ChromaDB.

### ARCH-04 — Dual UI with Stale Streamlit App
`app.py` (Streamlit) coexists with the Next.js + FastAPI stack. `app.py` hardcodes `"GPT-4o"` as the model display name in three places (lines 274, 367, 441) regardless of which model is actually running (Groq/Llama by default per `agent/agent.py` `build_llm()`). Two UIs, no shared state, no clear deprecation path.

---

## Low

### SEC-02 — No API Key Rotation Policy
`.env` contains a live Groq API key. No rotation documentation, no expiry enforcement. Key was exposed in a diagnostic tool run (recommend rotation).

---

## Fixed (verified 2026-07-03)

- **PATH-01 / PATH-02** (path traversal via unsanitized ticker) — `_sanitize_ticker()` + `_TICKER_RE` in `agent/tools/base.py:13-20`, called at the top of every tool function (`fetch_stock_data`, `run_monte_carlo_simulation`, `calculate_risk_metrics`, `analyze_portfolio`, `run_stress_test_tool`, `export_analysis_report`, `get_financial_news`, `compute_efficient_frontier_tool`) before the ticker reaches any file path construction.
- **SEC-01** (Excel formula injection) — `_FORMULA_PREFIXES = ('=', '+', '-', '@')` quoting in `export/excel_exporter.py:22`, applied at cell-write time on lines 340 and 354 (correlation sheet headers/labels).
- **CORRECT-01** (VaR/CVaR mislabeled as historical when actually simulation-based) — `calculate_risk_metrics` (`agent/tools/base.py:90-107`) now returns historical VaR/CVaR as primary (`var`, `cvar`, plus explicit `var_hist`/`cvar_hist`) alongside GBM-simulation values (`var_sim`, `cvar_sim`). `explain_risk` (`agent/tools/base.py:110-151`) explains both methods and states the caveat that historical simulation and GBM have different assumptions.
- **CORRECT-02 / CORRECT-03** (non-reproducible / export numbers differ from screen) — `run_monte_carlo` has `seed: int = 42` default (`simulation/monte_carlo.py:5`, `np.random.seed(seed)` on line 18). `export_analysis_report` (`agent/tools/base.py:199-224`) uses the same seeded `run_monte_carlo` call as the on-screen metrics, so exported figures match chat output.
- **CORRECT-04** (hardcoded 2020-01-01 data window) — `_default_start()` in `agent/tools/base.py:23-25` returns a rolling 5-year window from today; used as the default across all tools (commit 38e8c6b).
- **PERF-01** (no Groq API timeout) — `request_timeout=60` passed to `ChatGroq(...)` in `agent/agent.py:31`.
- **PERF-02** (redundant yfinance downloads) — `data/market_data.py` now has a thread-safe in-process cache (`_cache_lock`, `_price_cache`, `_CACHE_TTL = 300` seconds) in `fetch_prices()` (lines 13-30, 48-50, 57), added in commit 9458470. Repeated calls for the same ticker/start within 5 minutes reuse cached data instead of re-fetching.
- **ARCH-01** (mid-stream disconnect leaks server tasks) — `api/main.py` `generate()` (lines 107-129) cancels the background `run()` task on `asyncio.CancelledError` and in a `finally` block (`if not task.done(): task.cancel()`), so client disconnects no longer leave the agent task running to completion.
- **ARCH-03** (LangSmith Hub network call at startup) — `agent/agent.py` no longer calls `hub.pull(...)`; `make_executor()` builds the ReAct `PromptTemplate` inline (lines 42-64) with no external network dependency at startup.
- **BUG-01** (PowerBI exporter wrong metric keys) — `export/powerbi_exporter.py:69,76,83,90` reads `risk_metrics.get("var")`, `.get("cvar")`, `.get("sharpe")`, `.get("max_drawdown")`, matching the keys actually produced by `export_analysis_report` in `agent/tools/base.py:206-213`.
- **DEPLOY-01** (hardcoded localhost in frontend) — `frontend/src/lib/sseClient.ts:3` reads `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"` (commit d670996).
- **DEPLOY-02** (CORS locked to localhost) — `_allowed_origins()` in `api/main.py:35-37` reads `ALLOWED_ORIGINS` env var (comma-separated), defaulting to `http://localhost:3000` (commit 3342ab7).
- **Rate limiting + optional API key** — `api/main.py:17-23` implements a per-IP sliding-window rate limiter (`RATE_LIMIT` env var, default 20 req/min) and an optional `X-API-Key` header check (enabled when `API_KEY` env var is set), enforced at the top of `/api/chat` (lines 67-85).
