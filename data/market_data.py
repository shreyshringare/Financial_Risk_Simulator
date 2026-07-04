"""
Resilient market data fetcher.
Fallback chain: yfinance → pandas_datareader (Stooq) → BeautifulSoup Yahoo scrape
Each source is tried in order; first success is returned.
"""
import time
import threading
import numpy as np
import pandas as pd
import yfinance as yf
from typing import Optional

_cache_lock = threading.Lock()
_price_cache: dict = {}
_CACHE_TTL = 300  # 5 minutes


def _get_cached(ticker: str, start: str):
    key = (ticker, start)
    with _cache_lock:
        entry = _price_cache.get(key)
        if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
            return entry["data"]
    return None


def _set_cached(ticker: str, start: str, data) -> None:
    key = (ticker, start)
    with _cache_lock:
        _price_cache[key] = {"data": data, "ts": time.time()}


def fetch_prices(ticker: str, start: str = "2020-01-01") -> pd.Series:
    """
    Fetch historical Close prices with multi-source fallback.

    Tries in order:
    1. yfinance (primary)
    2. pandas_datareader Stooq (fallback)
    3. BeautifulSoup Yahoo Finance scrape (last resort)

    Returns:
        pd.Series of Close prices with DatetimeIndex.

    Raises:
        RuntimeError if all sources fail.
    """
    cached = _get_cached(ticker, start)
    if cached is not None:
        return cached

    # Source 1: yfinance
    try:
        data = yf.download(ticker, start=start, progress=False)
        if not data.empty:
            close = data["Close"]
            # yfinance 0.2+ returns multi-level columns for single tickers
            if isinstance(close, pd.DataFrame):
                close = close.iloc[:, 0]
            result = close.dropna()
            _set_cached(ticker, start, result)
            return result
    except Exception:
        pass

    # Source 2: pandas_datareader Stooq
    try:
        import pandas_datareader.data as web
        # Stooq uses different ticker format (no .NS suffix)
        stooq_ticker = ticker.replace(".NS", ".NS").replace(".L", ".UK").replace(".TO", ".CA")
        df = web.DataReader(stooq_ticker, "stooq", start=start)
        if not df.empty:
            result = df["Close"].sort_index().dropna()
            _set_cached(ticker, start, result)
            return result
    except Exception:
        pass

    # Source 3: BeautifulSoup Yahoo scrape — historical data not feasible via scrape, use as info source
    try:
        import requests
        from bs4 import BeautifulSoup
        url = f"https://finance.yahoo.com/quote/{ticker}"
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")
        # Scrape current price from the page
        price_tag = soup.find("fin-streamer", {"data-field": "regularMarketPrice"})
        if price_tag:
            price = float(price_tag.get("value", 0))
            # Return single-point Series (limited but better than nothing)
            result = pd.Series([price], index=[pd.Timestamp.now().normalize()])
            _set_cached(ticker, start, result)
            return result
    except Exception:
        pass

    raise RuntimeError(f"All data sources failed for {ticker}")


def get_data_source_status() -> dict:
    """
    Check which data sources are available in the current environment.
    Returns dict: {"yfinance": bool, "pandas_datareader": bool, "beautifulsoup": bool, "selenium": bool}
    """
    status = {}

    try:
        import yfinance  # noqa: F401
        status["yfinance"] = True
    except ImportError:
        status["yfinance"] = False

    try:
        import pandas_datareader  # noqa: F401
        status["pandas_datareader"] = True
    except ImportError:
        status["pandas_datareader"] = False

    try:
        import bs4  # noqa: F401
        status["beautifulsoup"] = True
    except ImportError:
        status["beautifulsoup"] = False

    try:
        import selenium  # noqa: F401
        status["selenium"] = True
    except ImportError:
        status["selenium"] = False

    return status
