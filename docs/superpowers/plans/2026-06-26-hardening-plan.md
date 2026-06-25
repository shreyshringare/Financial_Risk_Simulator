# FinSim Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 issues across security, correctness, and reliability in 3 sequential domain-grouped commits.

**Architecture:** Three independent batches — security (ticker sanitization + export path guards), correctness (historical VaR/CVaR, deterministic seeds, export consistency, PowerBI key fix), reliability (Groq timeout + SSE task cleanup). Each batch is committed separately and leaves tests passing.

**Tech Stack:** Python 3.x, FastAPI, LangChain, NumPy, pandas, openpyxl, Next.js 16, TypeScript, pytest

---

## File Map

| File | What changes |
|------|-------------|
| `agent/tools.py` | Add `_sanitize_ticker()`, call it in all ticker tools, update `calculate_risk_metrics` to return hist+sim VaR, restructure `export_analysis_report` |
| `simulation/risk_metrics.py` | Add `calculate_historical_var()` and `calculate_historical_cvar()` |
| `simulation/monte_carlo.py` | Add `seed: int = 42` parameter |
| `portfolio/efficient_frontier.py` | Add `seed: int = 42` parameter |
| `export/excel_exporter.py` | `os.path.basename()` on filename, formula injection guard on ticker cell writes |
| `export/powerbi_exporter.py` | `os.path.basename()` on all 6 file paths, fix metric key names (`var_95`→`var`, etc.) |
| `agent/agent.py` | Add `request_timeout=60` to `ChatGroq` |
| `api/main.py` | Add `try/finally` task cancellation in `generate()` |
| `frontend/src/components/cards/RiskCard.tsx` | Add hist VaR/CVaR rows with method badges |
| `frontend/src/types/events.ts` | Add `var_hist`, `cvar_hist`, `var_sim`, `cvar_sim` to `RiskData` |
| `tests/test_simulation.py` | Add 3 tests for historical VaR and MC reproducibility |

---

## BATCH 1 — SECURITY

---

### Task 1: Add `_sanitize_ticker()` and apply to all ticker tools

**Files:**
- Modify: `agent/tools.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_tools.py`:

```python
import re
import pytest

def test_sanitize_ticker_valid():
    from agent.tools import _sanitize_ticker
    assert _sanitize_ticker("aapl") == "AAPL"
    assert _sanitize_ticker(" msft ") == "MSFT"
    assert _sanitize_ticker("^GSPC") == "^GSPC"
    assert _sanitize_ticker("TCS.NS") == "TCS.NS"
    assert _sanitize_ticker("VODAFONE.L") == "VODAFONE.L"

def test_sanitize_ticker_invalid():
    from agent.tools import _sanitize_ticker
    with pytest.raises(ValueError):
        _sanitize_ticker("../../etc/passwd")
    with pytest.raises(ValueError):
        _sanitize_ticker("")
    with pytest.raises(ValueError):
        _sanitize_ticker("A" * 13)
    with pytest.raises(ValueError):
        _sanitize_ticker("AAPL; DROP TABLE")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "D:/SDE Projects/FinancialSim"
venv/Scripts/python -m pytest tests/test_tools.py::test_sanitize_ticker_valid tests/test_tools.py::test_sanitize_ticker_invalid -v
```

Expected: `ImportError: cannot import name '_sanitize_ticker'`

- [ ] **Step 3: Add `_sanitize_ticker` and `import re` to `agent/tools.py`**

Add after the existing imports at the top of `agent/tools.py` (after `load_dotenv()`):

```python
import re

_TICKER_RE = re.compile(r'^[A-Z0-9.\^-]{1,12}$')

def _sanitize_ticker(ticker: str) -> str:
    """Validate and normalise a ticker symbol. Raises ValueError on invalid input."""
    t = ticker.strip().upper()
    if not _TICKER_RE.match(t):
        raise ValueError(f"Invalid ticker symbol: '{ticker}'")
    return t
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
venv/Scripts/python -m pytest tests/test_tools.py::test_sanitize_ticker_valid tests/test_tools.py::test_sanitize_ticker_invalid -v
```

Expected: 2 PASSED

- [ ] **Step 5: Apply `_sanitize_ticker` to all ticker tool functions**

In `agent/tools.py`, add `ticker = _sanitize_ticker(ticker)` as the first line inside the `try:` block of each of these tools:
- `fetch_stock_data` (line ~36)
- `run_monte_carlo_simulation` (line ~55)
- `calculate_risk_metrics` (line ~76)
- `run_stress_test_tool` (line ~168)
- `export_analysis_report` (line ~184)
- `get_financial_news` (line ~211)

For the two CSV-ticker tools, apply after splitting:

```python
# In analyze_portfolio (line ~150):
tickers = [_sanitize_ticker(t) for t in tickers_csv.split(",")]

# In compute_efficient_frontier_tool (line ~229):
tickers = [_sanitize_ticker(t) for t in tickers_csv.split(",")]
```

- [ ] **Step 6: Run full test suite to verify no regressions**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all existing tests pass (ticker tools now sanitize first, but test inputs are valid tickers)

- [ ] **Step 7: Commit (do NOT commit yet — wait for Task 2 and 3)**

Hold commit until end of Batch 1.

---

### Task 2: Path traversal defense in export files

**Files:**
- Modify: `export/excel_exporter.py:380`
- Modify: `export/powerbi_exporter.py` (6 file path constructions)

- [ ] **Step 1: Fix `export/excel_exporter.py`**

Find line ~380:
```python
filename = f"{ticker}_risk_report_{timestamp}.xlsx"
filepath = os.path.join(output_dir, filename)
```

Replace with:
```python
filename = os.path.basename(f"{ticker}_risk_report_{timestamp}.xlsx")
filepath = os.path.join(output_dir, filename)
```

- [ ] **Step 2: Fix `export/powerbi_exporter.py` — all 6 file paths**

Find each `os.path.join(output_dir, f"{ticker}_*.csv")` call. There are 6:

```python
# Change each of these:
prices_path = os.path.join(output_dir, f"{ticker}_prices.csv")
risk_metrics_path = os.path.join(output_dir, f"{ticker}_risk_metrics.csv")
mc_summary_path = os.path.join(output_dir, f"{ticker}_monte_carlo_summary.csv")
mc_percentiles_path = os.path.join(output_dir, f"{ticker}_monte_carlo_percentiles.csv")
stress_path = os.path.join(output_dir, f"{ticker}_stress_tests.csv")
corr_path = os.path.join(output_dir, f"{ticker}_correlation.csv")

# To (add os.path.basename around the f-string):
prices_path = os.path.join(output_dir, os.path.basename(f"{ticker}_prices.csv"))
risk_metrics_path = os.path.join(output_dir, os.path.basename(f"{ticker}_risk_metrics.csv"))
mc_summary_path = os.path.join(output_dir, os.path.basename(f"{ticker}_monte_carlo_summary.csv"))
mc_percentiles_path = os.path.join(output_dir, os.path.basename(f"{ticker}_monte_carlo_percentiles.csv"))
stress_path = os.path.join(output_dir, os.path.basename(f"{ticker}_stress_tests.csv"))
corr_path = os.path.join(output_dir, os.path.basename(f"{ticker}_correlation.csv"))
```

- [ ] **Step 3: Run tests**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass

---

### Task 3: Formula injection guard in Excel correlation headers

**Files:**
- Modify: `export/excel_exporter.py:338,352`

- [ ] **Step 1: Add the guard constant and apply to ticker cell writes**

In `export/excel_exporter.py`, find the correlation sheet section (around line 329). Add a module-level constant near the top of the file (after imports):

```python
_FORMULA_PREFIXES = ('=', '+', '-', '@')
```

Then find the two cell writes that write raw ticker strings:

```python
# Line ~338 — column header
c.value = t

# Line ~352 — row label
label_cell.value = row_ticker
```

Replace both with the guarded version:

```python
# Line ~338 — column header
c.value = ("'" + t) if t.startswith(_FORMULA_PREFIXES) else t

# Line ~352 — row label
label_cell.value = ("'" + row_ticker) if row_ticker.startswith(_FORMULA_PREFIXES) else row_ticker
```

- [ ] **Step 2: Run tests**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass

- [ ] **Step 3: Commit Batch 1**

```bash
cd "D:/SDE Projects/FinancialSim"
git add agent/tools.py export/excel_exporter.py export/powerbi_exporter.py tests/test_tools.py
git commit -m "fix(security): ticker sanitization, path traversal defense, formula injection guard"
```

---

## BATCH 2 — CORRECTNESS

---

### Task 4: Add `calculate_historical_var` and `calculate_historical_cvar`

**Files:**
- Modify: `simulation/risk_metrics.py`
- Modify: `tests/test_simulation.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/test_simulation.py`:

```python
import pandas as pd
import numpy as np

def _make_price_series():
    """Deterministic price series for testing: 500 days starting at 100."""
    np.random.seed(0)
    returns = np.random.normal(0.0005, 0.015, 500)
    prices = 100 * np.exp(np.cumsum(returns))
    return pd.Series(prices)

def test_historical_var_is_negative():
    from simulation.risk_metrics import calculate_historical_var
    prices = _make_price_series()
    result = calculate_historical_var(prices)
    assert result < 0, "Historical VaR should be negative (a loss)"

def test_historical_cvar_more_negative_than_var():
    from simulation.risk_metrics import calculate_historical_var, calculate_historical_cvar
    prices = _make_price_series()
    var = calculate_historical_var(prices)
    cvar = calculate_historical_cvar(prices)
    assert cvar < var, "CVaR (expected shortfall) must be more negative than VaR"

def test_monte_carlo_seed_reproducible():
    from simulation.monte_carlo import run_monte_carlo
    prices = _make_price_series()
    paths_a = run_monte_carlo(prices, days=10, simulations=5, seed=42)
    paths_b = run_monte_carlo(prices, days=10, simulations=5, seed=42)
    np.testing.assert_array_equal(paths_a, paths_b)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
venv/Scripts/python -m pytest tests/test_simulation.py::test_historical_var_is_negative tests/test_simulation.py::test_historical_cvar_more_negative_than_var tests/test_simulation.py::test_monte_carlo_seed_reproducible -v
```

Expected: `ImportError: cannot import name 'calculate_historical_var'` and seed test fails (no seed param yet)

- [ ] **Step 3: Add functions to `simulation/risk_metrics.py`**

Append to the end of `simulation/risk_metrics.py`:

```python
def calculate_historical_var(prices: pd.Series, confidence: float = 0.95) -> float:
    """
    Historical simulation VaR.

    Uses actual realized daily returns with no distributional assumption.
    Industry standard for equity risk at sell-side desks.

    Args:
        prices: Historical price Series
        confidence: Confidence level (default 0.95 = 95%)

    Returns:
        VaR as negative float. E.g. -0.021 = 2.1% daily loss at 95% confidence.
    """
    returns = prices.pct_change().dropna()
    return float(np.percentile(returns, (1 - confidence) * 100))


def calculate_historical_cvar(prices: pd.Series, confidence: float = 0.95) -> float:
    """
    Historical simulation CVaR (Expected Shortfall).

    Mean of realized returns that fall at or below the historical VaR threshold.
    Always more negative than VaR.

    Args:
        prices: Historical price Series
        confidence: Confidence level (default 0.95)

    Returns:
        CVaR as negative float. More negative than VaR.
    """
    returns = prices.pct_change().dropna()
    threshold = calculate_historical_var(prices, confidence)
    return float(returns[returns <= threshold].mean())
```

- [ ] **Step 4: Run historical VaR tests to verify they pass**

```bash
venv/Scripts/python -m pytest tests/test_simulation.py::test_historical_var_is_negative tests/test_simulation.py::test_historical_cvar_more_negative_than_var -v
```

Expected: 2 PASSED

---

### Task 5: Add `seed` parameter to `run_monte_carlo`

**Files:**
- Modify: `simulation/monte_carlo.py`

- [ ] **Step 1: Add `seed` parameter**

In `simulation/monte_carlo.py`, replace the function signature and add `np.random.seed(seed)`:

```python
def run_monte_carlo(prices: pd.Series, days: int = 252, simulations: int = 1000, seed: int = 42) -> np.ndarray:
    """
    Run vectorized GBM Monte Carlo simulation.

    Args:
        prices: Historical price Series
        days: Number of days to simulate
        simulations: Number of simulation paths
        seed: Random seed for reproducibility (default 42)

    Returns:
        np.ndarray of shape (simulations, days) — price paths
    """
    np.random.seed(seed)
    log_returns = np.log(prices / prices.shift(1)).dropna()
    mu = log_returns.mean()
    sigma = log_returns.std()
    last_price = prices.iloc[-1]

    dt = 1 / 252
    Z = np.random.normal(size=(simulations, days))
    daily_returns = np.exp((mu - 0.5 * sigma ** 2) * dt + sigma * np.sqrt(dt) * Z)
    price_paths = last_price * np.cumprod(daily_returns, axis=1)

    return price_paths
```

- [ ] **Step 2: Run all three new tests**

```bash
venv/Scripts/python -m pytest tests/test_simulation.py::test_historical_var_is_negative tests/test_simulation.py::test_historical_cvar_more_negative_than_var tests/test_simulation.py::test_monte_carlo_seed_reproducible -v
```

Expected: 3 PASSED

- [ ] **Step 3: Run full test suite**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass (existing MC tests don't pass `seed` so they get default 42 — still valid)

---

### Task 6: Add `seed` parameter to `compute_efficient_frontier`

**Files:**
- Modify: `portfolio/efficient_frontier.py`

- [ ] **Step 1: Add `seed` parameter**

In `portfolio/efficient_frontier.py`, update the function signature and add `np.random.seed(seed)` as first line of the body:

```python
def compute_efficient_frontier(
    prices_df: pd.DataFrame,
    n_portfolios: int = 5000,
    risk_free_rate: float = 0.02,
    seed: int = 42,
) -> pd.DataFrame:
```

Add as the first line of the function body (before Step 1 comment):

```python
    np.random.seed(seed)
```

- [ ] **Step 2: Run tests**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass

---

### Task 7: Update `calculate_risk_metrics` tool to return historical + sim VaR

**Files:**
- Modify: `agent/tools.py`
- Modify: `frontend/src/types/events.ts`
- Modify: `frontend/src/components/cards/RiskCard.tsx`

- [ ] **Step 1: Update imports in `agent/tools.py`**

Find the existing import line:
```python
from simulation.risk_metrics import calculate_var, calculate_cvar, calculate_sharpe, calculate_max_drawdown
```

Replace with:
```python
from simulation.risk_metrics import (
    calculate_var, calculate_cvar,
    calculate_historical_var, calculate_historical_cvar,
    calculate_sharpe, calculate_max_drawdown,
)
```

- [ ] **Step 2: Replace the `calculate_risk_metrics` tool body**

Find the `calculate_risk_metrics` tool (starts at `@tool` before `def calculate_risk_metrics`) and replace the entire function:

```python
@tool
def calculate_risk_metrics(ticker: str) -> str:
    """Calculate VaR, CVaR, Sharpe ratio, and max drawdown for a stock. Returns both historical-simulation and GBM-simulation VaR as JSON string."""
    try:
        ticker = _sanitize_ticker(ticker)
        data = yf.download(ticker, start="2020-01-01", progress=False)
        prices = data['Close'].squeeze().dropna()
        paths = run_monte_carlo(prices, days=252, simulations=1000)

        var_hist = calculate_historical_var(prices)
        cvar_hist = calculate_historical_cvar(prices)
        var_sim = calculate_var(paths)
        cvar_sim = calculate_cvar(paths)
        sharpe = calculate_sharpe(prices)
        max_drawdown = calculate_max_drawdown(prices)

        return json.dumps({
            "var": round(float(var_hist), 4),       # canonical: hist sim
            "cvar": round(float(cvar_hist), 4),     # canonical: hist sim
            "var_hist": round(float(var_hist), 4),
            "cvar_hist": round(float(cvar_hist), 4),
            "var_sim": round(float(var_sim), 4),
            "cvar_sim": round(float(cvar_sim), 4),
            "sharpe": round(float(sharpe), 4),
            "max_drawdown": round(float(max_drawdown), 4),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})
```

- [ ] **Step 3: Update `explain_risk` caveat text in `agent/tools.py`**

Find the caveat string at the end of `explain_risk` that says:
```python
        f"Important caveat: These metrics are derived from a Geometric Brownian Motion (GBM) simulation, which assumes "
        f"log-normally distributed returns, constant volatility, and no sudden price jumps. "
        f"In reality, markets exhibit fat tails, volatility clustering, and regime changes — so actual tail losses may be worse than these numbers suggest."
```

Replace with:
```python
        f"Important caveat: VaR and CVaR use historical simulation (actual realized returns, no distributional assumption) — "
        f"the industry standard for equity risk. The Sharpe ratio and drawdown are computed from the same historical price series. "
        f"Historical simulation assumes the past return distribution is representative of future tail risk, "
        f"which may understate losses during regime changes, market crises, or periods of structurally higher volatility."
```

- [ ] **Step 4: Update `RiskData` type in `frontend/src/types/events.ts`**

Find the `RiskData` type definition. It currently has `var`, `cvar`, `sharpe`, `max_drawdown`. Add the new fields:

```typescript
export type RiskData = {
  var: number;
  cvar: number;
  var_hist: number;
  cvar_hist: number;
  var_sim: number;
  cvar_sim: number;
  sharpe: number;
  max_drawdown: number;
};
```

- [ ] **Step 5: Update `RiskCard.tsx` to show both VaR methods**

Replace the entire file content of `frontend/src/components/cards/RiskCard.tsx`:

```tsx
import type { RiskData } from "@/types/events";
import {
  riskLevel, riskBadgeClass, riskOverallClass, overallRisk,
  formatPct, type RiskLevel,
} from "@/lib/riskUtils";

export default function RiskCard({ data }: { data: RiskData }) {
  const overall = overallRisk(data.var, data.sharpe, data.max_drawdown);
  const sharpeLevel: RiskLevel = data.sharpe > 1 ? "LOW" : data.sharpe > 0.5 ? "MODERATE" : "HIGH";

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Risk Metrics</div>
      <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <RiskRow
            label="VaR 95% — Hist Sim"
            value={formatPct(data.var_hist ?? data.var)}
            level={riskLevel(data.var_hist ?? data.var)}
            method="HIST"
          />
          <RiskRow
            label="CVaR 95% — Hist Sim"
            value={formatPct(data.cvar_hist ?? data.cvar)}
            level={riskLevel(data.cvar_hist ?? data.cvar)}
            method="HIST"
          />
          <RiskRow
            label="VaR 95% — GBM Sim"
            value={formatPct(data.var_sim ?? data.var)}
            level={riskLevel(data.var_sim ?? data.var)}
            method="GBM"
          />
          <RiskRow
            label="CVaR 95% — GBM Sim"
            value={formatPct(data.cvar_sim ?? data.cvar)}
            level={riskLevel(data.cvar_sim ?? data.cvar)}
            method="GBM"
          />
          <RiskRow label="Sharpe Ratio"    value={data.sharpe.toFixed(4)}       level={sharpeLevel} />
          <RiskRow label="Maximum Drawdown" value={formatPct(data.max_drawdown)} level={riskLevel(data.max_drawdown)} />
        </div>
        <OverallRating level={overall} />
      </div>
    </div>
  );
}

function RiskRow({
  label, value, level, method,
}: {
  label: string; value: string; level: RiskLevel; method?: "HIST" | "GBM";
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 0", borderBottom: "1px solid var(--border-dim)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.5px" }}>{label}</span>
        {method && (
          <span style={{
            fontSize: 8, letterSpacing: 1, padding: "1px 4px",
            border: `1px solid ${method === "HIST" ? "rgba(255,180,60,0.4)" : "rgba(255,180,60,0.15)"}`,
            color: method === "HIST" ? "var(--amber)" : "var(--text-dim)",
            fontFamily: "var(--font-mono)",
          }}>
            {method}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="font-display" style={{ fontSize: 20, color: "var(--text)", letterSpacing: 1 }}>{value}</span>
        <span className={riskBadgeClass(level)}>{level}</span>
      </div>
    </div>
  );
}

function OverallRating({ level }: { level: RiskLevel }) {
  const label = level === "MODERATE" ? "MOD" : level;
  return (
    <div style={{
      width: 100, flexShrink: 0,
      border: "1px solid var(--border)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 6, padding: 12,
      background: "rgba(255,180,60,0.02)",
    }}>
      <div style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-faint)" }}>
        Risk Rating
      </div>
      <div className={riskOverallClass(level)}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass

---

### Task 8: Fix PowerBI metric key names

**Files:**
- Modify: `export/powerbi_exporter.py`

- [ ] **Step 1: Fix the docstring key names**

Find line ~31:
```python
        risk_metrics:     Dict with keys: var_95, cvar_95, sharpe_ratio, max_drawdown.
```

Replace with:
```python
        risk_metrics:     Dict with keys: var, cvar, sharpe, max_drawdown.
```

- [ ] **Step 2: Fix the four `.get()` calls**

Find and replace each stale key:

```python
# Line ~69 — change:
"value": risk_metrics.get("var_95", np.nan),
# To:
"value": risk_metrics.get("var", np.nan),

# Line ~76 — change:
"value": risk_metrics.get("cvar_95", np.nan),
# To:
"value": risk_metrics.get("cvar", np.nan),

# Line ~83 — change:
"value": risk_metrics.get("sharpe_ratio", np.nan),
# To:
"value": risk_metrics.get("sharpe", np.nan),

# Line ~90 — max_drawdown is already correct, verify it reads:
"value": risk_metrics.get("max_drawdown", np.nan),
```

- [ ] **Step 3: Run tests**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass

---

### Task 9: Restructure `export_analysis_report` for data consistency

**Files:**
- Modify: `agent/tools.py`

- [ ] **Step 1: Replace `export_analysis_report` tool body**

Find the `export_analysis_report` tool (starts at `@tool` before `def export_analysis_report`) and replace the entire function:

```python
@tool
def export_analysis_report(ticker: str, format: str = "excel") -> str:
    """Export risk analysis to Excel or PowerBI format. format: 'excel' or 'powerbi'. Returns file path(s) as JSON."""
    try:
        ticker = _sanitize_ticker(ticker)
        data = yf.download(ticker, start="2020-01-01", progress=False)
        prices = data['Close'].squeeze().dropna()

        # Single MC run — seed=42 matches calculate_risk_metrics output
        paths = run_monte_carlo(prices, days=252, simulations=1000)

        metrics = {
            "var": round(float(calculate_historical_var(prices)), 4),
            "cvar": round(float(calculate_historical_cvar(prices)), 4),
            "var_sim": round(float(calculate_var(paths)), 4),
            "cvar_sim": round(float(calculate_cvar(paths)), 4),
            "sharpe": round(float(calculate_sharpe(prices)), 4),
            "max_drawdown": round(float(calculate_max_drawdown(prices)), 4),
        }

        stress_df = None  # optional; not re-computed in export to keep it lightweight

        if format == "powerbi":
            file_dict = export_for_powerbi(ticker, prices, paths, metrics, stress_df)
            return json.dumps({"format": "powerbi", "files": file_dict})
        else:
            path = export_risk_report(ticker, paths, metrics, stress_df)
            return json.dumps({"format": "excel", "file": path})

    except Exception as e:
        return json.dumps({"error": str(e)})
```

- [ ] **Step 2: Run tests**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass

- [ ] **Step 3: Commit Batch 2**

```bash
git add simulation/risk_metrics.py simulation/monte_carlo.py portfolio/efficient_frontier.py \
        agent/tools.py export/powerbi_exporter.py \
        frontend/src/types/events.ts frontend/src/components/cards/RiskCard.tsx \
        tests/test_simulation.py
git commit -m "fix(correctness): historical sim VaR/CVaR, reproducible seeds, export consistency, PowerBI key fix"
```

---

## BATCH 3 — RELIABILITY

---

### Task 10: Add Groq timeout

**Files:**
- Modify: `agent/agent.py`

- [ ] **Step 1: Add `request_timeout=60` to `ChatGroq`**

In `agent/agent.py`, find the `_build_llm` function. Find the `ChatGroq(...)` instantiation and add `request_timeout=60`:

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

- [ ] **Step 2: Run tests**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass

---

### Task 11: Add agent task cleanup on client disconnect

**Files:**
- Modify: `api/main.py`

- [ ] **Step 1: Find the `generate` function**

In `api/main.py`, find lines around 108-124. The current `generate()` body looks like:

```python
async def generate() -> AsyncIterator[str]:
    async def run() -> None:
        try:
            await agent_executor.ainvoke(
                {"input": req.message},
                config={"callbacks": [callback]},
            )
        except Exception as exc:
            await callback._put({"type": "error", "message": str(exc)})
            await callback.queue.put(None)

    task = asyncio.create_task(run())
    async for event_str in callback.aiter():
        yield event_str
    await task
```

- [ ] **Step 2: Add try/finally for task cancellation**

Replace the last 3 lines (from `task = asyncio.create_task(run())` to `await task`) with:

```python
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

- [ ] **Step 3: Run tests**

```bash
venv/Scripts/python -m pytest tests/ -v
```

Expected: all tests pass

- [ ] **Step 4: Commit Batch 3**

```bash
git add agent/agent.py api/main.py
git commit -m "fix(reliability): Groq request timeout, cancel agent task on SSE disconnect"
```

---

## Verification

After all 3 commits:

- [ ] **Run full test suite one final time**

```bash
venv/Scripts/python -m pytest tests/ -v --tb=short
```

Expected output: 14 tests collected, 14 passed (11 original + 3 new)

- [ ] **Sanity check historical VaR math**

```bash
venv/Scripts/python -c "
import yfinance as yf, numpy as np
from simulation.risk_metrics import calculate_historical_var, calculate_historical_cvar
data = yf.download('AAPL', start='2020-01-01', progress=False)
prices = data['Close'].squeeze().dropna()
print(f'Hist VaR 95%: {calculate_historical_var(prices):.4f}')
print(f'Hist CVaR 95%: {calculate_historical_cvar(prices):.4f}')
# VaR should be ~ -0.02 to -0.04 (2-4% daily loss at 95%)
# CVaR should be more negative than VaR
"
```

- [ ] **Sanity check seed reproducibility**

```bash
venv/Scripts/python -c "
import yfinance as yf, numpy as np
from simulation.monte_carlo import run_monte_carlo
data = yf.download('AAPL', start='2020-01-01', progress=False)
prices = data['Close'].squeeze().dropna()
a = run_monte_carlo(prices, days=5, simulations=3, seed=42)
b = run_monte_carlo(prices, days=5, simulations=3, seed=42)
print('Reproducible:', np.array_equal(a, b))
"
```
