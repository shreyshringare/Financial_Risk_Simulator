"""
Tests for data/market_data.py — all network calls are mocked.
"""
import time
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock


def _fake_yf_result(ticker: str, prices: list[float]) -> MagicMock:
    """Return a mock yf.download result with a simple Close column."""
    idx = pd.date_range("2024-01-01", periods=len(prices), freq="B")
    df = pd.DataFrame({"Close": prices}, index=idx)
    return df


# ---------------------------------------------------------------------------
# fetch_prices
# ---------------------------------------------------------------------------

def test_fetch_prices_yfinance_success():
    from data.market_data import fetch_prices, _price_cache
    _price_cache.clear()

    mock_df = _fake_yf_result("AAPL", [150.0, 151.0, 152.0])

    with patch("yfinance.download", return_value=mock_df):
        result = fetch_prices("AAPL", start="2024-01-01")

    assert isinstance(result, pd.Series)
    assert len(result) == 3
    assert result.iloc[-1] == pytest.approx(152.0)


def test_fetch_prices_cache_hit():
    from data.market_data import fetch_prices, _price_cache
    _price_cache.clear()

    mock_df = _fake_yf_result("MSFT", [300.0, 301.0])

    with patch("yfinance.download", return_value=mock_df) as mock_dl:
        fetch_prices("MSFT", start="2024-01-01")
        fetch_prices("MSFT", start="2024-01-01")  # second call — should hit cache

    # yfinance.download must only be called once
    assert mock_dl.call_count == 1


def test_fetch_prices_all_sources_fail_raises():
    """If all three sources fail, RuntimeError is raised."""
    from data.market_data import fetch_prices, _price_cache
    _price_cache.clear()

    with patch("yfinance.download", side_effect=Exception("yf down")), \
         patch("pandas_datareader.data.DataReader", side_effect=Exception("pdr down")), \
         patch("requests.get", side_effect=Exception("scrape down")):
        with pytest.raises(RuntimeError, match="All data sources failed"):
            fetch_prices("FAIL", start="2024-01-01")


def test_fetch_prices_multilevel_columns_squeezed():
    """yfinance 0.2+ may return multi-level columns; they should be squeezed to Series."""
    from data.market_data import fetch_prices, _price_cache
    _price_cache.clear()

    idx = pd.date_range("2024-01-01", periods=3, freq="B")
    # Simulate multi-level column DataFrame
    close_df = pd.DataFrame({"AAPL": [150.0, 151.0, 152.0]}, index=idx)
    close_df.columns = pd.MultiIndex.from_tuples([("Close", "AAPL")])
    outer_df = pd.DataFrame(index=idx)
    outer_df[("Close", "AAPL")] = [150.0, 151.0, 152.0]

    # Wrap in a mock that returns a DataFrame with Close as a DataFrame (multi-level)
    mock_result = MagicMock()
    mock_result.empty = False
    mock_result.__getitem__ = lambda self, key: close_df if key == "Close" else MagicMock()

    with patch("yfinance.download", return_value=mock_result):
        result = fetch_prices("AAPL", start="2024-01-01")

    # Result must be a Series (squeezed)
    assert isinstance(result, pd.Series)


# ---------------------------------------------------------------------------
# get_data_source_status
# ---------------------------------------------------------------------------

def test_get_data_source_status_returns_expected_keys():
    from data.market_data import get_data_source_status

    status = get_data_source_status()

    assert isinstance(status, dict)
    assert "yfinance" in status
    assert "pandas_datareader" in status
    assert "beautifulsoup" in status
    assert "selenium" in status
    assert all(isinstance(v, bool) for v in status.values())


def test_get_data_source_status_yfinance_true():
    """yfinance is installed in this environment."""
    from data.market_data import get_data_source_status

    status = get_data_source_status()
    assert status["yfinance"] is True
