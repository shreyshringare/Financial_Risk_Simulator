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

def _d1_d2(S: float, K: float, T: float, r: float, sigma: float) -> tuple:
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
):
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
            return None  # no solution in bracket
        return brentq(objective, lo, hi, xtol=1e-6, maxiter=100)
    except (ValueError, RuntimeError):
        return None


# ── Agent tool ────────────────────────────────────────────────────────────────

def _run_analyze_option(
    ticker: str,
    strike: float,
    expiry_days: int,
    option_type: str,
    risk_free_rate: float = 0.05,
) -> str:
    """Implementation called by the @tool wrapper and directly by tests."""
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
        hist_full = yf.download(ticker, period="6mo", auto_adjust=True, progress=False)
        closes = hist_full["Close"].dropna().squeeze()
        S = float(closes.iloc[-1])   # most recent close = current price
        log_returns = np.log(closes / closes.shift(1)).dropna()
        sigma = float(log_returns.std() * np.sqrt(252))
        sigma = max(0.05, min(sigma, 2.0))  # clamp to [5%, 200%] as sanity bounds

        bsm = _bsm_price(S, K, T, r, sigma, opt_type)
        greeks = _compute_greeks(S, K, T, r, sigma, opt_type)

        iv_display = round(sigma * 100, 2)  # historical vol as "implied vol estimate"

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


@tool
def analyze_option(input_json: str) -> str:
    """
    Full Black-Scholes analysis for a European option: BSM price, historical vol,
    and all Greeks (delta, gamma, vega, theta, rho) with plain-English interpretations.

    Uses 6-month historical volatility as the vol proxy (no live option prices needed).

    Action Input MUST be a JSON string with these keys:
      ticker       - stock symbol, e.g. "AAPL" (uppercase)
      strike       - strike price as a number, e.g. 200.0
      expiry_days  - days until expiry as an integer, e.g. 90
      option_type  - "call" or "put"
      risk_free_rate - (optional) annual rate as decimal, default 0.05

    Example Action Input: {"ticker": "AAPL", "strike": 200.0, "expiry_days": 90, "option_type": "call"}
    """
    try:
        params = json.loads(input_json)
    except (json.JSONDecodeError, TypeError):
        return json.dumps({"error": f"Action Input must be a JSON string. Got: {input_json!r}"})
    return _run_analyze_option(
        ticker=str(params.get("ticker", "")),
        strike=float(params.get("strike", 0)),
        expiry_days=int(params.get("expiry_days", 0)),
        option_type=str(params.get("option_type", "call")),
        risk_free_rate=float(params.get("risk_free_rate", 0.05)),
    )
