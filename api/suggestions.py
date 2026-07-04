"""
News-driven dynamic quick queries.
Scans today's market headlines for recognizable tickers/company names and
builds suggested queries from them, falling back to static suggestions
when news is unavailable or no tickers are found.
"""
import re
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from news.rss_feed import fetch_market_headlines

# Common company name -> ticker map. "openai"/"anthropic" intentionally
# excluded (private companies, no public ticker).
TICKER_NAMES: Dict[str, str] = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "nvidia": "NVDA",
    "tesla": "TSLA",
    "amazon": "AMZN",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "meta": "META",
    "netflix": "NFLX",
    "amd": "AMD",
    "intel": "INTC",
    "boeing": "BA",
    "jpmorgan": "JPM",
    "goldman": "GS",
    "disney": "DIS",
    "oracle": "ORCL",
    "broadcom": "AVGO",
    "palantir": "PLTR",
}

_TICKER_TOKEN_RE = re.compile(r"\b[A-Z]{2,5}\b")

_TEMPLATES = [
    "What is the VaR for {t}?",
    "Get the latest news for {t}",
    "Run a Monte Carlo simulation for {t}",
    "Stress test {t} against the 2008 financial crisis",
]

_STATIC_FALLBACKS = [
    {"query": "Analyze a portfolio of AAPL, MSFT, TSLA", "source": None},
    {"query": "Price a $200 call on NVDA expiring in 90 days", "source": None},
    {"query": "Compute the efficient frontier for AAPL, MSFT, GOOGL", "source": None},
    {"query": "What is the VaR for RELIANCE.NS?", "source": None},
    {"query": "Export a risk report for AAPL to Excel", "source": None},
]

_GENERIC_FALLBACKS = [
    {"query": "What is the VaR for AAPL?", "source": None},
    {"query": "Get the latest news for NVDA", "source": None},
    {"query": "Run a Monte Carlo simulation for TSLA", "source": None},
]

_MIN_SUGGESTIONS = 8
_MAX_SUGGESTIONS = 10
_MAX_NEWS_TICKERS = 4

_cache_lock = threading.Lock()
_cache: dict = {}
_CACHE_TTL = 15 * 60  # 15 minutes
_CACHE_KEY = "suggestions"


def _get_cached() -> Optional[dict]:
    with _cache_lock:
        entry = _cache.get(_CACHE_KEY)
        if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
            return entry["data"]
    return None


def _set_cached(data: dict) -> None:
    with _cache_lock:
        _cache[_CACHE_KEY] = {"data": data, "ts": time.time()}


def _extract_ticker_headline_pairs(articles: List[Dict]) -> List[Tuple[str, str]]:
    """Scan headline titles for known company names and bare ticker tokens."""
    known_tickers = set(TICKER_NAMES.values())
    pairs: List[Tuple[str, str]] = []
    seen_tickers = set()

    for article in articles:
        title = article.get("title", "") or ""
        if not title:
            continue
        lowered = title.lower()

        found_in_title = []
        for name, ticker in TICKER_NAMES.items():
            if name in lowered and ticker not in found_in_title:
                found_in_title.append(ticker)

        for token in _TICKER_TOKEN_RE.findall(title):
            if token in known_tickers and token not in found_in_title:
                found_in_title.append(token)

        for ticker in found_in_title:
            if ticker not in seen_tickers:
                seen_tickers.add(ticker)
                pairs.append((ticker, title))

    return pairs


def build_suggestions() -> dict:
    cached = _get_cached()
    if cached is not None:
        return cached

    try:
        articles = fetch_market_headlines(max_articles=10)
    except Exception:
        articles = []

    pairs = _extract_ticker_headline_pairs(articles)[:_MAX_NEWS_TICKERS]

    suggestions = []
    for i, (ticker, headline) in enumerate(pairs):
        template = _TEMPLATES[i % len(_TEMPLATES)]
        suggestions.append({
            "query": template.format(t=ticker),
            "source": headline[:80],
        })

    # Fill up with static fallbacks until we reach the minimum.
    fallback_pool = list(_STATIC_FALLBACKS)
    if len(pairs) < 3:
        fallback_pool = fallback_pool + _GENERIC_FALLBACKS

    for fallback in fallback_pool:
        if len(suggestions) >= _MIN_SUGGESTIONS:
            break
        if fallback["query"] not in {s["query"] for s in suggestions}:
            suggestions.append(fallback)

    suggestions = suggestions[:_MAX_SUGGESTIONS]

    result = {
        "suggestions": suggestions,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    _set_cached(result)
    return result
