# tests/test_options.py
import math
import json
import pytest
import numpy as np
import pandas as pd
from unittest.mock import patch


# ── BSM math tests (pure, no network) ────────────────────────────────────────

from agent.tools.options import _bsm_price, _compute_greeks, _calculate_implied_vol


@pytest.mark.parametrize("S,K,T,r,sigma,opt_type,expected", [
    (100.0, 100.0, 1.0, 0.05, 0.20, "call", 10.45),   # ATM call — textbook value
    (100.0, 110.0, 1.0, 0.05, 0.20, "call",  6.04),   # OTM call
    (100.0, 110.0, 1.0, 0.05, 0.20, "put",  10.67),   # ITM put
])
def test_bsm_price_known_values(S, K, T, r, sigma, opt_type, expected):
    result = _bsm_price(S, K, T, r, sigma, opt_type)
    assert abs(result - expected) / expected < 0.01, (
        f"BSM {opt_type} S={S} K={K}: got {result:.4f}, expected {expected:.4f}"
    )


def test_bsm_call_put_parity():
    """Put-call parity: C - P = S - K*e^(-rT)"""
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
    if market_price > 1e-6:
        result = _calculate_implied_vol(S, K, T, r, market_price, "call")
        assert result is not None
        assert 0.001 < result < 5.0


# ── analyze_option tool test (mocked yfinance) ────────────────────────────────

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
