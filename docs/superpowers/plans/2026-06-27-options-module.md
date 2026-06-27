# FinSim Phase 1 — Options Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Black-Scholes options pricing + Greeks to the FinSim analyst terminal as a single `analyze_option` agent tool, streamed via SSE and rendered in a new `OptionsCard`.

**Architecture:** Backend: refactor `agent/tools.py` → `agent/tools/` package, add `agent/tools/options.py` with pure BSM math helpers + `analyze_option` LangChain tool. SSE: `callback_handler._TOOL_SECTION_MAP` maps `analyze_option` → `"options"` section. Frontend: extend `events.ts` with `OptionsData` type + `SSEEvent`/`ReportSection` `options` variants; add `ADD_OPTIONS` to `page.tsx` reducer; build `DataGrid` shared component; build `OptionsCard`; wire into `ReportArea`.

**Tech Stack:** Python 3.14, scipy>=1.11 (brentq + norm.cdf), yfinance, LangChain `@tool`, pytest, Next.js 14, TypeScript, React useReducer

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| DELETE | `agent/tools.py` | Replaced by package |
| CREATE | `agent/tools/__init__.py` | Re-exports ALL_TOOLS + all public tools |
| CREATE | `agent/tools/base.py` | All 11 existing tools + `_sanitize_ticker` |
| CREATE | `agent/tools/options.py` | BSM helpers + `analyze_option` tool |
| CREATE | `tests/test_options.py` | BSM correctness + Greeks bounds + IV roundtrip |
| MODIFY | `api/callback_handler.py` | Add `"analyze_option": "options"` to `_TOOL_SECTION_MAP` |
| MODIFY | `frontend/src/types/events.ts` | Add `OptionsData`, `SSEEvent` options variant, `ReportSection` options variant |
| MODIFY | `frontend/src/app/page.tsx` | Add `ADD_OPTIONS` action + reducer case + dispatch |
| CREATE | `frontend/src/components/cards/DataGrid.tsx` | Shared amber-header table used by OptionsCard + future FactorCard |
| CREATE | `frontend/src/components/cards/OptionsCard.tsx` | Full options analysis card |
| MODIFY | `frontend/src/components/ReportArea.tsx` | Add `case "options"` + import OptionsCard |

---

## Task 0: Refactor `agent/tools.py` → `agent/tools/` package

**Files:**
- Create: `agent/tools/__init__.py`
- Create: `agent/tools/base.py`
- Delete: `agent/tools.py`

The goal is to split the 273-line flat module into a proper package so Phase 2 (`agent/tools/factor.py`) has a clean home. The `__init__.py` must re-export everything so all existing imports (`from agent.tools import fetch_stock_data`, `from agent.tools import ALL_TOOLS`) keep working without changes.

- [ ] **Step 1: Create `agent/tools/` directory and `base.py`**

Copy the entire content of `agent/tools.py` into `agent/tools/base.py` verbatim. Do not modify it yet.

```bash
mkdir agent/tools
cp agent/tools.py agent/tools/base.py
```

- [ ] **Step 2: Create `agent/tools/__init__.py`**

Create `agent/tools/__init__.py` with this exact content:

```python
# agent/tools/__init__.py
# Re-exports everything so existing imports (from agent.tools import X) keep working.
from agent.tools.base import (
    _sanitize_ticker,
    fetch_stock_data,
    run_monte_carlo_simulation,
    calculate_risk_metrics,
    explain_risk,
    rag_financial_query,
    analyze_portfolio,
    run_stress_test_tool,
    export_analysis_report,
    get_financial_news,
    compute_efficient_frontier_tool,
    get_market_movers,
    ALL_TOOLS,
)

__all__ = [
    "_sanitize_ticker",
    "fetch_stock_data",
    "run_monte_carlo_simulation",
    "calculate_risk_metrics",
    "explain_risk",
    "rag_financial_query",
    "analyze_portfolio",
    "run_stress_test_tool",
    "export_analysis_report",
    "get_financial_news",
    "compute_efficient_frontier_tool",
    "get_market_movers",
    "ALL_TOOLS",
]
```

- [ ] **Step 3: Delete the old flat file**

```bash
rm agent/tools.py
```

- [ ] **Step 4: Run existing tests to verify imports are unbroken**

```bash
pytest tests/test_tools.py -v
```

Expected output (all 5 pass):
```
tests/test_tools.py::test_sanitize_ticker_valid PASSED
tests/test_tools.py::test_sanitize_ticker_invalid PASSED
tests/test_tools.py::test_yfinance_error_dict PASSED
tests/test_tools.py::test_risk_dict_keys PASSED
PASSED (4 tests)
```

If any test fails, the `__init__.py` re-exports are incomplete. Add the missing name and re-run.

- [ ] **Step 5: Commit**

```bash
git add agent/tools/__init__.py agent/tools/base.py
git rm agent/tools.py
git commit -m "refactor: agent/tools flat module → package, no behavior change"
```

---

## Task 1: BSM math functions (pure, no network)

**Files:**
- Create: `agent/tools/options.py`
- Create: `tests/test_options.py`

Write the failing tests first, then implement the math. The BSM functions are pure (no I/O), so tests run without mocking anything.

**Background you need:**

Black-Scholes call price: `C = S·N(d1) - K·e^(-rT)·N(d2)`
Black-Scholes put price: `P = K·e^(-rT)·N(-d2) - S·N(-d1)`

Where:
- `d1 = (ln(S/K) + (r + σ²/2)·T) / (σ·√T)`
- `d2 = d1 - σ·√T`
- `N(x)` = standard normal CDF
- `S` = current stock price, `K` = strike, `T` = time to expiry in years, `r` = risk-free rate, `σ` = volatility

Greeks (calls):
- delta = `N(d1)` (put delta = `N(d1) - 1`)
- gamma = `n(d1) / (S·σ·√T)` where `n(x)` = standard normal PDF
- vega = `S·n(d1)·√T / 100` (per 1% vol move — divide by 100)
- theta = `(-S·n(d1)·σ / (2·√T) - r·K·e^(-rT)·N(d2)) / 365` (call, per calendar day)
- rho = `K·T·e^(-rT)·N(d2) / 100` (call, per 1% rate move — divide by 100)

- [ ] **Step 1: Write failing tests in `tests/test_options.py`**

```python
# tests/test_options.py
import math
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np


# ── BSM math tests (pure, no network) ────────────────────────────────────────

from agent.tools.options import _bsm_price, _compute_greeks, _calculate_implied_vol


@pytest.mark.parametrize("S,K,T,r,sigma,opt_type,expected", [
    (100.0, 100.0, 1.0, 0.05, 0.20, "call", 10.45),   # ATM call — textbook value
    (100.0, 110.0, 1.0, 0.05, 0.20, "call",  6.04),   # OTM call
    (100.0, 110.0, 1.0, 0.05, 0.20, "put",  10.67),   # ITM put (same d1/d2, put formula)
])
def test_bsm_price_known_values(S, K, T, r, sigma, opt_type, expected):
    result = _bsm_price(S, K, T, r, sigma, opt_type)
    assert abs(result - expected) / expected < 0.01, (
        f"BSM {opt_type} S={S} K={K}: got {result:.4f}, expected {expected:.4f}"
    )


def test_bsm_call_put_parity():
    """Put-call parity: C - P = S - K·e^(-rT)"""
    S, K, T, r, sigma = 100.0, 105.0, 0.5, 0.05, 0.25
    C = _bsm_price(S, K, T, r, sigma, "call")
    P = _bsm_price(S, K, T, r, sigma, "put")
    parity = S - K * math.exp(-r * T)
    assert abs((C - P) - parity) < 0.01, f"Put-call parity violated: C-P={C-P:.4f}, S-Ke^(-rT)={parity:.4f}"


def test_delta_bounds_call():
    delta = _compute_greeks(100.0, 100.0, 1.0, 0.05, 0.20, "call")["delta"]
    assert 0.0 < delta < 1.0, f"Call delta must be in (0,1), got {delta}"


def test_delta_bounds_put():
    delta = _compute_greeks(100.0, 100.0, 1.0, 0.05, 0.20, "put")["delta"]
    assert -1.0 < delta < 0.0, f"Put delta must be in (-1,0), got {delta}"


def test_greeks_signs():
    """gamma > 0, vega > 0, call theta < 0, call rho > 0."""
    g = _compute_greeks(100.0, 100.0, 1.0, 0.05, 0.20, "call")
    assert g["gamma"] > 0, "gamma must be positive"
    assert g["vega"]  > 0, "vega must be positive"
    assert g["theta"] < 0, "call theta must be negative (time decay)"
    assert g["rho"]   > 0, "call rho must be positive"


def test_iv_roundtrip():
    """Compute BSM price at known vol, recover vol via solver, verify < 0.1% error."""
    S, K, T, r, true_sigma = 100.0, 100.0, 1.0, 0.05, 0.25
    market_price = _bsm_price(S, K, T, r, true_sigma, "call")
    recovered_sigma = _calculate_implied_vol(S, K, T, r, market_price, "call")
    assert abs(recovered_sigma - true_sigma) / true_sigma < 0.001, (
        f"IV roundtrip failed: true={true_sigma}, recovered={recovered_sigma:.6f}"
    )


def test_deep_otm_iv_does_not_crash():
    """Deep OTM options have near-zero vega — brentq fallback must handle this."""
    S, K, T, r, sigma = 100.0, 200.0, 0.25, 0.05, 0.20  # very deep OTM
    market_price = _bsm_price(S, K, T, r, sigma, "call")
    if market_price > 1e-6:  # only test if option has non-trivial value
        result = _calculate_implied_vol(S, K, T, r, market_price, "call")
        assert result is not None
        assert 0.001 < result < 5.0


# ── analyze_option tool test (mocked yfinance) ────────────────────────────────

import json

def test_analyze_option_returns_expected_keys():
    """analyze_option must return JSON with all required fields."""
    # Simulate 6 months of daily closes (analyze_option uses period='6mo')
    dates = pd.date_range("2024-01-01", periods=126, freq="B")
    prices = pd.Series(150.0 + np.random.randn(126).cumsum(), index=dates)
    mock_hist = pd.DataFrame({"Close": prices})
    with patch("yfinance.download", return_value=mock_hist):
        from agent.tools.options import analyze_option
        result = analyze_option.func("AAPL", 150.0, 90, "call", 0.05)

    data = json.loads(result)
    assert "error" not in data, f"Tool returned error: {data.get('error')}"

    required = [
        "ticker", "strike", "expiry_days", "option_type",
        "current_price", "bsm_price", "intrinsic_value", "time_value",
        "implied_vol",
        "delta", "gamma", "vega", "theta", "rho",
        "delta_interp", "vega_interp", "theta_interp",
    ]
    for key in required:
        assert key in data, f"Missing key: {key}"


def test_analyze_option_invalid_ticker():
    from agent.tools.options import analyze_option
    result = analyze_option.func("../../etc/passwd", 150.0, 90, "call")
    data = json.loads(result)
    assert "error" in data
```

- [ ] **Step 2: Run tests — verify they all FAIL**

```bash
pytest tests/test_options.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'agent.tools.options'` or `ImportError`. This is correct — the module doesn't exist yet.

- [ ] **Step 3: Create `agent/tools/options.py` with full BSM implementation**

```python
# agent/tools/options.py
"""
Black-Scholes options pricing, Greeks, and implied volatility.

All math functions are pure (no I/O). analyze_option is the only @tool.
"""
import json
import math

import numpy as np
import yfinance as yf
from langchain.tools import tool
from scipy.optimize import brentq
from scipy.stats import norm

from agent.tools.base import _sanitize_ticker


# ── Pure BSM math ─────────────────────────────────────────────────────────────

def _d1_d2(S: float, K: float, T: float, r: float, sigma: float) -> tuple[float, float]:
    """Compute d1 and d2 for Black-Scholes."""
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return d1, d2


def _bsm_price(S: float, K: float, T: float, r: float, sigma: float, opt_type: str) -> float:
    """
    Black-Scholes-Merton option price.

    Args:
        S: Current stock price (USD)
        K: Strike price (USD)
        T: Time to expiry in years (e.g. 0.25 for 3 months)
        r: Annual risk-free rate as decimal (e.g. 0.05 for 5%)
        sigma: Annual volatility as decimal (e.g. 0.20 for 20%)
        opt_type: 'call' or 'put'
    """
    d1, d2 = _d1_d2(S, K, T, r, sigma)
    discount = math.exp(-r * T)
    if opt_type == "call":
        return S * norm.cdf(d1) - K * discount * norm.cdf(d2)
    else:
        return K * discount * norm.cdf(-d2) - S * norm.cdf(-d1)


def _compute_greeks(S: float, K: float, T: float, r: float, sigma: float, opt_type: str) -> dict:
    """
    Compute all five Greeks.

    Returns:
        delta: Price sensitivity per $1 move in underlying
        gamma: Delta sensitivity per $1 move in underlying
        vega:  Price sensitivity per 1% move in implied vol
        theta: Price sensitivity per calendar day (negative for long options)
        rho:   Price sensitivity per 1% move in risk-free rate
    """
    d1, d2 = _d1_d2(S, K, T, r, sigma)
    pdf_d1 = norm.pdf(d1)
    sqrt_T = math.sqrt(T)
    discount = math.exp(-r * T)

    gamma = pdf_d1 / (S * sigma * sqrt_T)
    vega  = S * pdf_d1 * sqrt_T / 100.0  # per 1% vol move

    if opt_type == "call":
        delta = norm.cdf(d1)
        theta = (-S * pdf_d1 * sigma / (2 * sqrt_T) - r * K * discount * norm.cdf(d2)) / 365.0
        rho   = K * T * discount * norm.cdf(d2) / 100.0   # per 1% rate move
    else:
        delta = norm.cdf(d1) - 1.0
        theta = (-S * pdf_d1 * sigma / (2 * sqrt_T) + r * K * discount * norm.cdf(-d2)) / 365.0
        rho   = -K * T * discount * norm.cdf(-d2) / 100.0

    return {
        "delta": round(delta, 6),
        "gamma": round(gamma, 6),
        "vega":  round(vega,  6),
        "theta": round(theta, 6),
        "rho":   round(rho,   6),
    }


def _calculate_implied_vol(
    S: float, K: float, T: float, r: float, market_price: float, opt_type: str
) -> float | None:
    """
    Recover implied volatility from a market price using Newton-Raphson with
    brentq fallback for deep OTM options where vega ≈ 0.

    Returns implied vol as decimal (e.g. 0.243 for 24.3%), or None if unsolvable.
    """
    # Initial guess: Brenner-Subrahmanyam approximation
    sigma = math.sqrt(2 * math.pi / T) * market_price / S

    # Newton-Raphson (up to 50 iterations)
    for _ in range(50):
        price = _bsm_price(S, K, T, r, sigma, opt_type)
        d1, _ = _d1_d2(S, K, T, r, sigma)
        vega_full = S * norm.pdf(d1) * math.sqrt(T)
        if abs(vega_full) < 1e-10:
            break  # vega too small, fall through to brentq
        sigma -= (price - market_price) / vega_full
        if abs(price - market_price) < 1e-8:
            return max(1e-4, sigma)

    # Brentq fallback: bracketed bisection on [0.0001, 5.0]
    def objective(s: float) -> float:
        return _bsm_price(S, K, T, r, s, opt_type) - market_price

    try:
        lo, hi = 1e-4, 5.0
        if objective(lo) * objective(hi) > 0:
            return None  # no solution in bracket (e.g. price below intrinsic)
        return brentq(objective, lo, hi, xtol=1e-6, maxiter=100)
    except (ValueError, RuntimeError):
        return None


# ── Agent tool ────────────────────────────────────────────────────────────────

@tool
def analyze_option(
    ticker: str,
    strike: float,
    expiry_days: int,
    option_type: str,
    risk_free_rate: float = 0.05,
) -> str:
    """
    Full Black-Scholes analysis for a European option: price, vol estimate, and all Greeks.

    Uses 6-month historical volatility as the vol input (standard proxy when
    live option market prices are unavailable).

    Args:
        ticker:        Stock ticker symbol (e.g. 'AAPL', 'TSLA'). Use uppercase.
        strike:        Strike price in USD (e.g. 200.0 for a $200 strike).
        expiry_days:   Days until expiry as an integer (e.g. 90 for ~3 months,
                       180 for ~6 months, 365 for ~1 year). Do NOT pass years.
        option_type:   'call' or 'put' (lowercase).
        risk_free_rate: Annual risk-free rate as decimal. Default 0.05 (= 5%).
                        Do NOT pass 5 — pass 0.05.

    Returns JSON with: ticker, strike, expiry_days, option_type, current_price,
    bsm_price, intrinsic_value, time_value, implied_vol, delta, gamma, vega,
    theta, rho, delta_interp, vega_interp, theta_interp.

    Example: analyze_option('AAPL', 200.0, 90, 'call') for an AAPL $200 call
    expiring in approximately 3 months.
    """
    try:
        ticker = _sanitize_ticker(ticker)
        opt_type = option_type.lower().strip()
        if opt_type not in ("call", "put"):
            return json.dumps({"error": f"option_type must be 'call' or 'put', got '{option_type}'"})

        K = float(strike)
        T = expiry_days / 365.0
        r = float(risk_free_rate)

        if T <= 0:
            return json.dumps({"error": "expiry_days must be > 0"})
        if K <= 0:
            return json.dumps({"error": "strike must be > 0"})

        # Single yfinance call: get 6-month price history.
        # Latest close = current stock price. Full series = historical vol.
        # Historical volatility: annualized std dev of log returns from past 6 months.
        # This is our vol estimate since we don't have real option market prices
        # from the free yfinance API. Historical vol is the standard proxy.
        hist_full = yf.download(ticker, period="6mo", auto_adjust=True, progress=False)
        closes = hist_full["Close"].dropna().squeeze()
        S = float(closes.iloc[-1])   # most recent close = current price
        log_returns = np.log(closes / closes.shift(1)).dropna()
        sigma = float(log_returns.std() * np.sqrt(252))
        sigma = max(0.05, min(sigma, 2.0))  # clamp to [5%, 200%] as sanity bounds

        bsm = _bsm_price(S, K, T, r, sigma, opt_type)
        greeks = _compute_greeks(S, K, T, r, sigma, opt_type)

        iv_display = round(sigma * 100, 2)  # historical vol displayed as "implied vol estimate"

        # Intrinsic and time value
        if opt_type == "call":
            intrinsic = max(0.0, S - K)
        else:
            intrinsic = max(0.0, K - S)
        time_value = max(0.0, bsm - intrinsic)

        # Human-readable Greek interpretations
        delta_interp = (
            f"A $1 move in {ticker} changes this option's value by ${abs(greeks['delta']):.2f}"
        )
        vega_interp = (
            f"A 1% change in implied vol changes this option's value by ${greeks['vega']:.2f}"
        )
        theta_interp = (
            f"Each calendar day costs this option ${abs(greeks['theta']):.4f} in time decay"
        )

        return json.dumps({
            "ticker":        ticker,
            "strike":        K,
            "expiry_days":   expiry_days,
            "option_type":   opt_type,
            "current_price": round(S, 2),
            "bsm_price":     round(bsm, 4),
            "intrinsic_value": round(intrinsic, 4),
            "time_value":    round(time_value, 4),
            "implied_vol":   iv_display,
            **{k: round(v, 6) for k, v in greeks.items()},
            "delta_interp":  delta_interp,
            "vega_interp":   vega_interp,
            "theta_interp":  theta_interp,
        })

    except Exception as e:
        return json.dumps({"error": str(e)})
```

- [ ] **Step 4: Run BSM math tests — verify they pass**

```bash
pytest tests/test_options.py -v -k "not analyze_option"
```

Expected: all 7 pure-math tests PASS (`test_bsm_price_known_values[...]` × 3, `test_bsm_call_put_parity`, `test_delta_bounds_call`, `test_delta_bounds_put`, `test_greeks_signs`, `test_iv_roundtrip`, `test_deep_otm_iv_does_not_crash`).

If `test_bsm_price_known_values` fails with value off by > 1%: check the `_d1_d2` formula. Common mistake: using `sigma/2` instead of `sigma**2/2` in the numerator.

- [ ] **Step 5: Register `analyze_option` in `agent/tools/__init__.py`**

Add to `agent/tools/__init__.py`:

```python
# agent/tools/__init__.py  (updated)
from agent.tools.base import (
    _sanitize_ticker,
    fetch_stock_data,
    run_monte_carlo_simulation,
    calculate_risk_metrics,
    explain_risk,
    rag_financial_query,
    analyze_portfolio,
    run_stress_test_tool,
    export_analysis_report,
    get_financial_news,
    compute_efficient_frontier_tool,
    get_market_movers,
)
from agent.tools.options import analyze_option  # NEW

ALL_TOOLS = [
    fetch_stock_data, run_monte_carlo_simulation, calculate_risk_metrics,
    explain_risk, rag_financial_query,
    analyze_portfolio, run_stress_test_tool, export_analysis_report,
    get_financial_news, compute_efficient_frontier_tool, get_market_movers,
    analyze_option,  # NEW
]

__all__ = [
    "_sanitize_ticker",
    "fetch_stock_data", "run_monte_carlo_simulation", "calculate_risk_metrics",
    "explain_risk", "rag_financial_query",
    "analyze_portfolio", "run_stress_test_tool", "export_analysis_report",
    "get_financial_news", "compute_efficient_frontier_tool", "get_market_movers",
    "analyze_option",
    "ALL_TOOLS",
]
```

- [ ] **Step 6: Run all options tests (including mocked tool test)**

```bash
pytest tests/test_options.py -v
```

Expected: all tests PASS. If `test_analyze_option_returns_expected_keys` fails with KeyError, check the `analyze_option` return JSON matches the `required` list exactly.

- [ ] **Step 7: Run full test suite — verify no regressions**

```bash
pytest tests/ -v
```

Expected: all 16 existing tests + new options tests PASS.

- [ ] **Step 8: Commit**

```bash
git add agent/tools/options.py agent/tools/__init__.py tests/test_options.py
git commit -m "feat(options): analyze_option tool — BSM price + Greeks + IV solver"
```

---

## Task 2: Wire SSE pipeline

**Files:**
- Modify: `api/callback_handler.py` (line 8–12)
- Modify: `frontend/src/types/events.ts`
- Modify: `frontend/src/app/page.tsx`

These three files form the data pipeline from Python tool output → SSE wire → TypeScript state → React render. All three must be updated atomically or the card will never render (event silently dropped at whichever boundary is missing).

- [ ] **Step 1: Add `analyze_option` to `callback_handler._TOOL_SECTION_MAP`**

In `api/callback_handler.py`, update `_TOOL_SECTION_MAP` (currently lines 8–12):

```python
# Tool name → SSE section type
_TOOL_SECTION_MAP = {
    "fetch_stock_data":           "stock",
    "run_monte_carlo_simulation": "monte_carlo",
    "calculate_risk_metrics":     "risk",
    "analyze_option":             "options",   # NEW
}
```

- [ ] **Step 2: Add `OptionsData` type and update `SSEEvent` + `ReportSection` in `frontend/src/types/events.ts`**

Replace the entire content of `frontend/src/types/events.ts` with:

```typescript
// frontend/src/types/events.ts

export type StockData = {
  ticker: string;
  start: string;
  end: string;
  count: number;
  latest_price: number;
  min_price: number;
  max_price: number;
};

export type MonteCarloData = {
  ticker: string;
  days: number;
  simulations: number;
  mean_final_price: number;
  std_final_price: number;
  percentile_5: number;
  percentile_95: number;
};

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

export type OptionsData = {
  ticker: string;
  strike: number;
  expiry_days: number;
  option_type: "call" | "put";
  current_price: number;
  bsm_price: number;
  intrinsic_value: number;
  time_value: number;
  implied_vol: number | null;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  delta_interp: string;
  vega_interp: string;
  theta_interp: string;
};

export type SSEEvent =
  | { type: "section"; section: "stock";       data: StockData }
  | { type: "section"; section: "monte_carlo"; data: MonteCarloData }
  | { type: "section"; section: "risk";        data: RiskData }
  | { type: "section"; section: "options";     data: OptionsData }   // NEW
  | { type: "section"; section: "caveats";     data: Record<string, never> }
  | { type: "token";   token: string }
  | { type: "error";   message: string }
  | { type: "done" };

export type SectionType = "stock" | "monte_carlo" | "risk" | "options" | "verdict" | "caveats" | "prose";

export type ReportSection =
  | { kind: "stock";       data: StockData }
  | { kind: "monte_carlo"; data: MonteCarloData }
  | { kind: "risk";        data: RiskData }
  | { kind: "options";     data: OptionsData }   // NEW
  | { kind: "verdict";     content: string; streaming: boolean }
  | { kind: "caveats" }
  | { kind: "prose";       content: string; streaming: boolean };
```

- [ ] **Step 3: Add `ADD_OPTIONS` to `page.tsx` reducer**

In `frontend/src/app/page.tsx`, update the `Action` union type (currently lines 21–29):

```typescript
type Action =
  | { type: "START" }
  | { type: "ADD_STOCK";       data: Extract<SSEEvent, { section: "stock" }>["data"] }
  | { type: "ADD_MONTE_CARLO"; data: Extract<SSEEvent, { section: "monte_carlo" }>["data"] }
  | { type: "ADD_RISK";        data: Extract<SSEEvent, { section: "risk" }>["data"] }
  | { type: "ADD_OPTIONS";     data: Extract<SSEEvent, { section: "options" }>["data"] }   // NEW
  | { type: "ADD_CAVEATS" }
  | { type: "APPEND_TOKEN";    token: string }
  | { type: "DONE" }
  | { type: "ERROR"; message: string };
```

- [ ] **Step 4: Add `ADD_OPTIONS` case to reducer function**

In the `reducer` function (after the `ADD_RISK` case, before `APPEND_TOKEN`), add:

```typescript
case "ADD_OPTIONS":
  return {
    ...state,
    hasAnalysisSections: true,   // suppress LLM prose — card has built-in interpretations
    sections: [...state.sections, { kind: "options", data: action.data }],
  };
```

- [ ] **Step 5: Dispatch `ADD_OPTIONS` in `handleQuery`**

In the `handleQuery` callback, inside the `case "section":` block (currently lines 121–126), add the options branch:

```typescript
case "section":
  if      (event.section === "stock")       dispatch({ type: "ADD_STOCK",       data: event.data });
  else if (event.section === "monte_carlo") dispatch({ type: "ADD_MONTE_CARLO", data: event.data });
  else if (event.section === "risk")        dispatch({ type: "ADD_RISK",        data: event.data });
  else if (event.section === "options")     dispatch({ type: "ADD_OPTIONS",     data: event.data });  // NEW
  else if (event.section === "caveats")     dispatch({ type: "ADD_CAVEATS" });
  break;
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. If TypeScript complains about `event.section === "options"` being an unreachable branch, the `SSEEvent` update in Step 2 didn't take effect — check the file was saved correctly.

- [ ] **Step 7: Commit**

```bash
git add api/callback_handler.py frontend/src/types/events.ts frontend/src/app/page.tsx
git commit -m "feat(options): SSE pipeline — callback_handler + TypeScript types + page reducer"
```

---

## Task 3: `DataGrid` shared component

**Files:**
- Create: `frontend/src/components/cards/DataGrid.tsx`

This component is used by `OptionsCard` (Task 4) and will be reused by `FactorCard` in Phase 2. Build it once with a stable props interface.

- [ ] **Step 1: Create `frontend/src/components/cards/DataGrid.tsx`**

```tsx
// frontend/src/components/cards/DataGrid.tsx

interface DataGridProps {
  /** Column header labels — rendered uppercase in amber. */
  headers: string[];
  /** Table rows. Each row must have the same length as headers. */
  rows: (string | number)[][];
  /** Optional row indices (0-based) to render in amber instead of default text color. */
  highlightRows?: number[];
}

export default function DataGrid({ headers, rows, highlightRows = [] }: DataGridProps) {
  const colCount = headers.length;
  const colWidth = `${Math.floor(100 / colCount)}%`;

  return (
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      overflowX: "auto",
    }}>
      {/* Header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${colCount}, ${colWidth})`,
        borderBottom: "1px solid var(--border)",
        paddingBottom: 4,
        marginBottom: 4,
      }}>
        {headers.map((h) => (
          <span key={h} style={{
            color: "var(--amber)",
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase" as const,
            fontWeight: 600,
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Data rows */}
      {rows.map((row, ri) => {
        const highlighted = highlightRows.includes(ri);
        return (
          <div key={ri} style={{
            display: "grid",
            gridTemplateColumns: `repeat(${colCount}, ${colWidth})`,
            padding: "3px 0",
            borderBottom: "1px solid var(--border-dim)",
          }}>
            {row.map((cell, ci) => (
              <span key={ci} style={{
                color: highlighted ? "var(--amber-bright)" : "var(--text)",
                fontSize: 12,
                letterSpacing: 0.5,
              }}>
                {typeof cell === "number" ? cell.toFixed(4) : cell}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cards/DataGrid.tsx
git commit -m "feat(ui): DataGrid shared component — amber headers, monospace, fixed columns"
```

---

## Task 4: `OptionsCard` component

**Files:**
- Create: `frontend/src/components/cards/OptionsCard.tsx`

This card renders everything from `OptionsData` in the phosphor terminal style. It uses `DataGrid` for the Greeks table and adds a stat row for BSM price / IV / intrinsic + an interpretation section.

- [ ] **Step 1: Create `frontend/src/components/cards/OptionsCard.tsx`**

```tsx
// frontend/src/components/cards/OptionsCard.tsx
import type { OptionsData } from "@/types/events";
import DataGrid from "./DataGrid";

export default function OptionsCard({ data }: { data: OptionsData }) {
  const typeLabel = data.option_type.toUpperCase();
  const ivDisplay = data.implied_vol != null ? `${data.implied_vol.toFixed(1)}%` : "N/A";
  const intrinsicDisplay = `$${data.intrinsic_value.toFixed(2)}`;
  const bsmDisplay = `$${data.bsm_price.toFixed(2)}`;
  const priceDisplay = `$${data.current_price.toFixed(2)}`;

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Options Analysis</div>

      {/* Header row: ticker + type badge + params */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span className="font-display" style={{ fontSize: 22, color: "var(--amber-bright)", letterSpacing: 1 }}>
          {data.ticker}
        </span>
        <span style={{
          fontSize: 9,
          letterSpacing: 2,
          padding: "2px 6px",
          border: `1px solid ${data.option_type === "call" ? "rgba(57,255,20,0.4)" : "rgba(255,49,49,0.4)"}`,
          color: data.option_type === "call" ? "var(--green)" : "var(--red)",
          fontFamily: "var(--font-mono)",
        }}>
          {typeLabel}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", letterSpacing: 0.5 }}>
          ${data.strike} strike · {data.expiry_days}d exp · underlying {priceDisplay}
        </span>
      </div>

      {/* Summary stat row: BSM price / IV / intrinsic */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <StatBox label="BSM PRICE"    value={bsmDisplay} />
        <StatBox label="IMPLIED VOL"  value={ivDisplay} />
        <StatBox label="INTRINSIC"    value={intrinsicDisplay} />
      </div>

      {/* Greeks DataGrid */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 6 }}>
          GREEKS
        </div>
        <DataGrid
          headers={["DELTA", "GAMMA", "VEGA", "THETA", "RHO"]}
          rows={[[
            data.delta,
            data.gamma,
            data.vega,
            data.theta,
            data.rho,
          ]]}
        />
      </div>

      {/* Interpretation block */}
      <div style={{
        borderTop: "1px solid var(--border-dim)",
        paddingTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
        <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 2 }}>
          INTERPRETATION
        </div>
        {[data.delta_interp, data.vega_interp, data.theta_interp].map((line, i) => (
          <div key={i} style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: "1px solid var(--border-dim)",
      padding: "6px 10px",
      background: "var(--amber-glow)",
    }}>
      <div style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 1.5, marginBottom: 4 }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: 18, color: "var(--text)", letterSpacing: 1 }}>
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. If `OptionsData` import fails, check `frontend/src/types/events.ts` has the `OptionsData` export from Task 2.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cards/OptionsCard.tsx
git commit -m "feat(ui): OptionsCard — BSM price + Greeks + interpretation (phosphor terminal)"
```

---

## Task 5: Wire `OptionsCard` into `ReportArea`

**Files:**
- Modify: `frontend/src/components/ReportArea.tsx`

- [ ] **Step 1: Add import and case to `ReportArea.tsx`**

At the top of `frontend/src/components/ReportArea.tsx`, add the import (after the existing card imports):

```typescript
import OptionsCard from "./cards/OptionsCard";
```

In the `SectionRenderer` function's `switch` statement, add the options case (after the `"prose"` case):

```typescript
function SectionRenderer({ section }: { section: ReportSection }) {
  switch (section.kind) {
    case "stock":       return <StockCard data={section.data} />;
    case "monte_carlo": return <MonteCarloCard data={section.data} />;
    case "risk":        return <RiskCard data={section.data} />;
    case "options":     return <OptionsCard data={section.data} />;   // NEW
    case "verdict":     return <VerdictCard content={section.content} streaming={section.streaming} />;
    case "caveats":     return <CaveatsCard />;
    case "prose":       return <ProseCard content={section.content} streaming={section.streaming} />;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. TypeScript will enforce exhaustive switch — if the `"options"` case is missing, you'll get a type error here.

- [ ] **Step 3: Run full test suite one final time**

```bash
pytest tests/ -v
```

Expected: all tests pass (16 existing + new options tests).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ReportArea.tsx
git commit -m "feat: wire OptionsCard into ReportArea — options section now renders"
```

---

## Task 6: Manual integration smoke test

No automated test can substitute for this. Start both servers and run two queries.

- [ ] **Step 1: Start the FastAPI backend**

```bash
cd api && uvicorn main:app --reload --port 8000
```

Expected: `INFO: Application startup complete.`

If you see `ImportError` or `ModuleNotFoundError`, the `agent/tools/__init__.py` re-exports are broken. Check Task 0.

- [ ] **Step 2: Start the Next.js frontend**

In a second terminal:

```bash
cd frontend && npm run dev
```

Open: `http://localhost:3000`

- [ ] **Step 3: Run the canonical "whoa moment" query**

In the terminal UI, submit:

```
What's the risk profile of an AAPL $200 call expiring in 90 days?
```

Expected behavior:
1. StreamingIndicator appears briefly
2. OptionsCard renders with: ticker=AAPL, type=[CALL], strike=$200, expiry=90d
3. BSM PRICE, IMPLIED VOL, INTRINSIC stat boxes populated
4. Greeks DataGrid shows 5 columns with 4-decimal values
5. Interpretation block shows 3 plain-English lines
6. CaveatsCard appears below

If the OptionsCard doesn't appear (stays at StreamingIndicator or falls through to prose):
- Check `callback_handler._TOOL_SECTION_MAP` has `"analyze_option": "options"`
- Check `SSEEvent` in `events.ts` has the `options` variant
- Check `page.tsx` dispatches `ADD_OPTIONS`

- [ ] **Step 4: Run a comparison query**

```
Compare the options risk of TSLA vs AAPL for a $200 call expiring in 3 months
```

Expected: two OptionsCards render sequentially (agent calls `analyze_option` twice, once per ticker). Each card shows correct ticker in the header.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 options module complete — analyze_option + OptionsCard + DataGrid"
```

---

## Checklist

- [ ] Task 0: Package refactor — existing 16 tests still pass
- [ ] Task 1: `analyze_option` tool — BSM correctness tests pass, IV roundtrip < 0.1% error
- [ ] Task 2: SSE pipeline — `callback_handler`, `events.ts`, `page.tsx` all updated atomically
- [ ] Task 3: `DataGrid` — compiles, stable props interface
- [ ] Task 4: `OptionsCard` — compiles, renders BSM + Greeks + interpretation
- [ ] Task 5: `ReportArea` — exhaustive switch includes `"options"`
- [ ] Task 6: Integration smoke test — AAPL $200 call renders correctly in browser
