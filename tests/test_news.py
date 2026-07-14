"""
Tests for news/rss_feed.py — feedparser calls are mocked.
"""
import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_feed_entry(title="Test headline", link="https://example.com/news",
                     published="Mon, 01 Jan 2024 00:00:00 GMT", summary="<p>Short summary</p>"):
    entry = MagicMock()
    entry.get = lambda key, default="": {
        "title": title, "link": link, "published": published, "summary": summary,
    }.get(key, default)
    return entry


def _make_feed(entries):
    feed = MagicMock()
    feed.entries = entries
    return feed


# ---------------------------------------------------------------------------
# format_news_for_agent
# ---------------------------------------------------------------------------

def test_format_news_empty_list():
    from news.rss_feed import format_news_for_agent

    result = format_news_for_agent([])
    assert result == "No articles found."


def test_format_news_single_article():
    from news.rss_feed import format_news_for_agent

    articles = [{"title": "AAPL surges", "link": "https://x.com", "published": "2024-01-01", "summary": "Apple hit a record."}]
    result = format_news_for_agent(articles)

    assert "[1] AAPL surges" in result
    assert "Published: 2024-01-01" in result
    assert "Apple hit a record." in result
    assert "https://x.com" in result


def test_format_news_truncates_long_summary():
    from news.rss_feed import format_news_for_agent

    long_summary = "x" * 300
    articles = [{"title": "Big news", "link": "", "published": "", "summary": long_summary}]
    result = format_news_for_agent(articles)

    assert "..." in result
    # Summary portion must not exceed 200 chars + "..."
    summary_line = [l for l in result.splitlines() if l.strip().startswith("Summary:")][0]
    assert len(summary_line) <= len("    Summary: ") + 203


def test_format_news_multiple_articles_numbered():
    from news.rss_feed import format_news_for_agent

    articles = [
        {"title": "First", "link": "", "published": "", "summary": ""},
        {"title": "Second", "link": "", "published": "", "summary": ""},
    ]
    result = format_news_for_agent(articles)
    assert "[1] First" in result
    assert "[2] Second" in result


# ---------------------------------------------------------------------------
# get_news_sentiment_keywords
# ---------------------------------------------------------------------------

def test_sentiment_bullish():
    from news.rss_feed import get_news_sentiment_keywords

    articles = [{"title": "Stock surges to record high on strong growth", "summary": "Rally continues as bulls gain."}]
    result = get_news_sentiment_keywords(articles)

    assert result["sentiment"] == "bullish"
    assert result["positive_count"] > result["negative_count"]
    assert isinstance(result["positive_hits"], list)
    assert isinstance(result["negative_hits"], list)


def test_sentiment_bearish():
    from news.rss_feed import get_news_sentiment_keywords

    articles = [{"title": "Market crash wipes out gains as losses mount", "summary": "Bears drag stocks down, miss estimates."}]
    result = get_news_sentiment_keywords(articles)

    assert result["sentiment"] == "bearish"
    assert result["negative_count"] > result["positive_count"]


def test_sentiment_neutral_equal_counts():
    from news.rss_feed import get_news_sentiment_keywords

    # "surge" positive, "crash" negative — equal → neutral
    articles = [{"title": "surge crash", "summary": ""}]
    result = get_news_sentiment_keywords(articles)

    assert result["sentiment"] == "neutral"


def test_sentiment_empty_articles():
    from news.rss_feed import get_news_sentiment_keywords

    result = get_news_sentiment_keywords([])
    assert result["sentiment"] == "neutral"
    assert result["positive_count"] == 0
    assert result["negative_count"] == 0


# ---------------------------------------------------------------------------
# fetch_ticker_news (mocked feedparser)
# ---------------------------------------------------------------------------

def test_fetch_ticker_news_returns_articles():
    from news.rss_feed import fetch_ticker_news

    entries = [
        _make_feed_entry(title="AAPL beats estimates"),
        _make_feed_entry(title="Apple new product"),
    ]
    mock_feed = _make_feed(entries)

    with patch("feedparser.parse", return_value=mock_feed):
        result = fetch_ticker_news("AAPL", max_articles=5)

    assert isinstance(result, list)
    assert len(result) == 2
    assert result[0]["title"] == "AAPL beats estimates"


def test_fetch_ticker_news_strips_html_from_summary():
    from news.rss_feed import fetch_ticker_news

    entries = [_make_feed_entry(summary="<b>Bold text</b> and <i>italic</i>")]
    mock_feed = _make_feed(entries)

    with patch("feedparser.parse", return_value=mock_feed):
        result = fetch_ticker_news("AAPL", max_articles=5)

    assert "<b>" not in result[0]["summary"]
    assert "Bold text" in result[0]["summary"]


def test_fetch_ticker_news_respects_max_articles():
    from news.rss_feed import fetch_ticker_news

    entries = [_make_feed_entry(title=f"Article {i}") for i in range(10)]
    mock_feed = _make_feed(entries)

    with patch("feedparser.parse", return_value=mock_feed):
        result = fetch_ticker_news("AAPL", max_articles=3)

    assert len(result) == 3


def test_fetch_ticker_news_returns_empty_on_exception():
    from news.rss_feed import fetch_ticker_news

    with patch("feedparser.parse", side_effect=RuntimeError("network error")):
        result = fetch_ticker_news("AAPL")

    assert result == []


# ---------------------------------------------------------------------------
# fetch_market_headlines (mocked feedparser)
# ---------------------------------------------------------------------------

def test_fetch_market_headlines_returns_articles():
    from news.rss_feed import fetch_market_headlines

    entries = [_make_feed_entry(title="Market rallies")]
    mock_feed = _make_feed(entries)

    with patch("feedparser.parse", return_value=mock_feed):
        result = fetch_market_headlines(max_articles=5)

    assert len(result) == 1
    assert result[0]["title"] == "Market rallies"


def test_fetch_market_headlines_falls_back_on_unknown_source():
    """Unknown source key falls back to marketwatch_top URL without raising."""
    from news.rss_feed import fetch_market_headlines, FEEDS

    entries = [_make_feed_entry(title="Fallback headline")]
    mock_feed = _make_feed(entries)

    with patch("feedparser.parse", return_value=mock_feed) as mock_parse:
        result = fetch_market_headlines(source="nonexistent_source", max_articles=5)

    # Must have used the fallback URL
    called_url = mock_parse.call_args[0][0]
    assert called_url == FEEDS["marketwatch_top"]
    assert len(result) == 1


def test_fetch_market_headlines_returns_empty_on_exception():
    from news.rss_feed import fetch_market_headlines

    with patch("feedparser.parse", side_effect=RuntimeError("timeout")):
        result = fetch_market_headlines()

    assert result == []
