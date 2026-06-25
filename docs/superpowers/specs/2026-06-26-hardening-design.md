# FinSim Hardening Design
**Date:** 2026-06-26  
**Status:** Approved  
**Scope:** Security · Correctness · Reliability  
**Context:** JPMC internship showcase — interviewers clone and run locally; public deployment planned later.

---

## Overview

Three-batch hardening pass addressing 9 issues found in the 2026-06-25 diagnostic. Delivered as 3 sequential commits with domain-grouped changes. No interface changes visible to the user except: (1) RiskCard gains historical VaR/CVaR rows, (2) Groq timeout surfaces errors instead of hanging, (3) export Excel numbers now match screen.

---

## Batch 1 — Security

**Commit:** `fix(security): ticker sanitization, path traversal, formula injection`

### 1.1 Ticker Sanitization

**File:** `agent/tools.py`

Add `_sanitize_ticker(ticker: str) -> str` at module top:

```python
import re

_TICKER_RE = re.compile(r'^[A-Z0-9.\^-]{1,12}$')

def _sanitize_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if not _TICKER_RE.match(t):
        raise ValueError(f"Invalid ticker symbol: '{ticker}'")
    return t
```

- Regex covers: standard tickers (`AAPL`), indices (`^GSPC`), global suffixes (`.NS`, `.L`, `.TO`, `.CA`), ETFs (`SPY`), max 12 chars
- Called at the top of every `@tool` function that accepts a `ticker` parameter before any downstream use
- `ValueError` caught by each tool's existing `try/except` → `json.dumps({"error": "Invalid ticker symbol: '...'"})`
- Also called on `tickers_csv` after split: `[_sanitize_ticker(t) for t in tickers_csv.split(",")]`

**Files changed:** `agent/tools.py`

### 1.2 Path Traversal Defense

**Files:** `export/excel_exporter.py`, `export/powerbi_exporter.py`

Ticker is already safe after `_sanitize_ticker` (regex excludes `/`, `\`, `..`). Add defense-in-depth: use `os.path.basename()` when constructing output filenames.

```python
# Before
filename = f"{ticker}_risk_report_{timestamp}.xlsx"
filepath = os.path.join(output_dir, filename)

# After
filename = os.path.basename(f"{ticker}_risk_report_{timestamp}.xlsx")
filepath = os.path.join(output_dir, filename)
```

Applied to all 7 output paths in both export files.

**Files changed:** `export/excel_exporter.py`, `export/powerbi_exporter.py`

### 1.3 Excel Formula Injection Guard

**File:** `export/excel_exporter.py`

In the correlation sheet where ticker is written directly as a cell value:

```python
# Before
c.value = t

# After
_FORMULA_PREFIXES = ('=', '+', '-', '@')
c.value = ("'" + t) if t.startswith(_FORMULA_PREFIXES) else t
```

Applied to every cell write where raw ticker string is the sole value (not embedded in a longer string). Note: after `_sanitize_ticker` the ticker is already uppercase alphanumeric + `.^-` so formula prefixes are impossible — this guard is defense-in-depth for callers that bypass sanitization.

**Files changed:** `export/excel_exporter.py`

---

## Batch 2 — Correctness

**Commit:** `fix(correctness): historical VaR, reproducible seed, export consistency, PowerBI keys`

### 2.1 Historical Simulation VaR/CVaR

**File:** `simulation/risk_metrics.py`

Add two new functions:

```python
def calculate_historical_var(prices: pd.Series, confidence: float = 0.95) -> float:
    """
    Historical simulation VaR.
    Uses actual realized daily returns — no distributional assumption.
    Industry standard for equity risk at JPMC and most sell-side desks.
    """
    returns = prices.pct_change().dropna()
    return float(np.percentile(returns, (1 - confidence) * 100))

def calculate_historical_cvar(prices: pd.Series, confidence: float = 0.95) -> float:
    """
    Historical simulation CVaR (Expected Shortfall).
    Mean of realized returns below the historical VaR threshold.
    """
    returns = prices.pct_change().dropna()
    threshold = calculate_historical_var(prices, confidence)
    return float(returns[returns <= threshold].mean())
```

**File:** `agent/tools.py` — `calculate_risk_metrics` tool updated (interface unchanged — still accepts `ticker: str`, fetches internally):

- Fetches prices via `yf.download(ticker, ...)` as before
- Runs `run_monte_carlo(prices)` to get GBM paths
- Calls both `calculate_var(paths)` / `calculate_cvar(paths)` (GBM sim) and `calculate_historical_var(prices)` / `calculate_historical_cvar(prices)` (historical) on the same fetched data
- Returns JSON with 4 VaR keys: `var_sim`, `cvar_sim`, `var_hist`, `cvar_hist`
- Existing `var`, `cvar` keys kept as aliases pointing to `var_hist` for backward compatibility with export

**File:** `frontend/src/components/cards/RiskCard.tsx`

Add two rows below existing VaR/CVaR displaying historical values with label `"HIST SIM"` badge to distinguish from `"GBM SIM"` badge on the existing rows.

**Files changed:** `simulation/risk_metrics.py`, `agent/tools.py`, `frontend/src/components/cards/RiskCard.tsx`

### 2.2 Reproducible Results

**File:** `simulation/monte_carlo.py`

```python
def run_monte_carlo(prices: pd.Series, days: int = 252, simulations: int = 1000, seed: int = 42) -> np.ndarray:
    np.random.seed(seed)
    # ... rest unchanged
```

**File:** `portfolio/efficient_frontier.py`

```python
def compute_efficient_frontier(prices_df: pd.DataFrame, n_portfolios: int = 5000, 
                                risk_free_rate: float = 0.02, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    # ... rest unchanged
```

All callers use default `seed=42`. Results are now deterministic across runs. Seed is an explicit parameter (not hardcoded) so tests or power users can vary it.

**Files changed:** `simulation/monte_carlo.py`, `portfolio/efficient_frontier.py`

### 2.3 Export Data Consistency

**File:** `agent/tools.py` — `export_analysis_report` tool

Currently re-fetches yfinance data and re-runs MC simulation independently from the earlier `calculate_risk_metrics` call. With seed=42 this is now deterministic, but still wasteful and confusing. Restructure the tool to fetch once and compute all derived data in sequence:

```python
@tool
def export_analysis_report(ticker: str, format: str = "excel") -> str:
    try:
        ticker = _sanitize_ticker(ticker)
        data = yf.download(ticker, start="2020-01-01", progress=False)
        prices = data['Close'].squeeze().dropna()
        paths = run_monte_carlo(prices, days=252, simulations=1000)  # seed=42 default
        metrics = {
            "var": round(float(calculate_historical_var(prices)), 4),   # hist as canonical
            "cvar": round(float(calculate_historical_cvar(prices)), 4),
            "var_sim": round(float(calculate_var(paths)), 4),
            "cvar_sim": round(float(calculate_cvar(paths)), 4),
            "sharpe": round(float(calculate_sharpe(prices)), 4),
            "max_drawdown": round(float(calculate_max_drawdown(prices)), 4),
        }
        # ... export call
    except Exception as e:
        return json.dumps({"error": str(e)})
```

With seed=42, the MC paths are identical to what `calculate_risk_metrics` produced for the same ticker in the same session. Numbers in Excel match screen.

**Files changed:** `agent/tools.py`

### 2.4 PowerBI Metric Key Fix

**File:** `export/powerbi_exporter.py`

Internal references to `risk_metrics["var_95"]`, `risk_metrics["cvar_95"]` etc. replaced with `risk_metrics["var"]`, `risk_metrics["cvar"]`, `risk_metrics["sharpe"]`, `risk_metrics["max_drawdown"]` — matching the dict keys actually passed by `export_analysis_report`. NaN values eliminated.

**Files changed:** `export/powerbi_exporter.py`

---

## Batch 3 — Reliability

**Commit:** `fix(reliability): Groq timeout, agent task cleanup on disconnect`

### 3.1 Groq API Timeout

**File:** `agent/agent.py`

```python
return ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    max_tokens=2000,
    api_key=groq_key,
    streaming=True,
    request_timeout=60,
)
```

60 seconds bounds worst-case stall. On timeout, the exception propagates to `on_chain_error` → `{type: "error", message: "Request timed out after 60s. Try again."}` → frontend displays error state instead of hanging indefinitely.

**Files changed:** `agent/agent.py`

### 3.2 Agent Task Cleanup on Client Disconnect

**File:** `api/main.py`

```python
async def generate() -> AsyncIterator[str]:
    task = asyncio.create_task(run())
    try:
        async for event_str in callback.aiter():
            yield event_str
        await task
    except asyncio.CancelledError:
        task.cancel()
        raise
    finally:
        if not task.done():
            task.cancel()
```

When the SSE client disconnects mid-stream, FastAPI/Starlette cancels the async generator. The `finally` block cancels the background agent task, stopping Groq API consumption and freeing threadpool slots for dead connections.

**Files changed:** `api/main.py`

### 3.3 yfinance Blocking (Non-issue — Removed)

Investigation confirmed: LangChain's `AgentExecutor.ainvoke` dispatches sync `@tool` functions via `run_in_executor` internally. `yf.download()` already runs off the event loop. No change needed.

---

## File Change Summary

| File | Batch | Change |
|------|-------|--------|
| `agent/tools.py` | 1, 2 | `_sanitize_ticker()`, hist VaR calls, export restructure |
| `export/excel_exporter.py` | 1 | `os.path.basename()`, formula injection guard |
| `export/powerbi_exporter.py` | 1, 2 | `os.path.basename()`, metric key fix |
| `simulation/risk_metrics.py` | 2 | `calculate_historical_var()`, `calculate_historical_cvar()` |
| `simulation/monte_carlo.py` | 2 | `seed=42` parameter |
| `portfolio/efficient_frontier.py` | 2 | `seed=42` parameter |
| `agent/agent.py` | 3 | `request_timeout=60` |
| `api/main.py` | 3 | Task cancellation on disconnect |
| `frontend/src/components/cards/RiskCard.tsx` | 2 | Hist VaR/CVaR rows with method badges |

**Total: 9 files, ~120 lines changed across 3 commits.**

---

## Testing

Existing 11 tests all pass (no interface breaks — new keys are additive, seed default maintains same contract).

Add 3 new tests to `tests/test_simulation.py`:
- `calculate_historical_var` returns negative float on real price series
- `calculate_historical_cvar` is more negative than `calculate_historical_var`
- `run_monte_carlo(seed=42)` called twice produces identical arrays

---

## Out of Scope

- CORS `allow_origins` hardcode (relevant only for deployment — deferred to Phase C)
- `API_BASE = "http://localhost:8000"` hardcode in `sseClient.ts` (same — deferred to deployment phase)
- `start="2020-01-01"` data window (low priority, no correctness impact for demo)
- Streamlit `app.py` legacy UI (not used in current stack)
