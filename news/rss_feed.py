"""
Financial news RSS feed aggregator.
Fetches headlines from Google News, Reuters, MarketWatch, and CNBC RSS feeds.
No API key required — all feeds are publicly available.

Dependencies: feedparser>=6.0.0
"""
import re
import feedparser
import time
from datetime import datetime
from typing import List, Dict, Optional


FEEDS = {
    "google_news": "https://news.google.com/rss/search?q={ticker}+stock&hl=en-US&gl=US&ceid=US:en",
    "marketwatch_top": "https://feeds.marketwatch.com/marketwatch/topstories/",
    "cnbc_finance": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "reuters_business": "https://feeds.reuters.com/reuters/businessNews",
}


def fetch_ticker_news(ticker: str, max_articles: int = 5) -> List[Dict]:
    """
    Fetch recent news articles for a specific ticker via Google News RSS.

    Args:
        ticker: Stock ticker (e.g. AAPL, RELIANCE.NS)
        max_articles: Max number of articles to return

    Returns:
        List of dicts: [{"title": str, "link": str, "published": str, "summary": str}, ...]
        Returns empty list on failure (never raises).
    """
    try:
        url = FEEDS["google_news"].format(ticker=ticker)
        feed = feedparser.parse(url)
        articles = []
        for entry in feed.entries[:max_articles]:
            raw_summary = entry.get("summary", "")
            clean_summary = re.sub(r"<[^>]+>", "", raw_summary)
            articles.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", "Unknown date"),
                "summary": clean_summary,
            })
        return articles
    except Exception:
        return []


def fetch_market_headlines(source: str = "marketwatch_top", max_articles: int = 5) -> List[Dict]:
    """
    Fetch general market headlines from a source feed.

    Args:
        source: Key from FEEDS dict (marketwatch_top, cnbc_finance, reuters_business)
        max_articles: Max articles

    Returns:
        List of dicts same format as fetch_ticker_news.
        Falls back to marketwatch_top if source not found.
    """
    try:
        url = FEEDS.get(source, FEEDS["marketwatch_top"])
        feed = feedparser.parse(url)
        articles = []
        for entry in feed.entries[:max_articles]:
            raw_summary = entry.get("summary", "")
            clean_summary = re.sub(r"<[^>]+>", "", raw_summary)
            articles.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", "Unknown date"),
                "summary": clean_summary,
            })
        return articles
    except Exception:
        return []


def format_news_for_agent(articles: List[Dict]) -> str:
    """
    Format news articles as a clean string for LangChain agent consumption.
    Truncates summaries to 200 chars. Returns 'No articles found.' if empty.

    Format:
    [1] TITLE
        Published: DATE
        Summary: SUMMARY...
        Link: URL

    [2] ...
    """
    if not articles:
        return "No articles found."

    lines = []
    for i, article in enumerate(articles, start=1):
        summary = article.get("summary", "")
        if len(summary) > 200:
            summary = summary[:200] + "..."
        lines.append(f"[{i}] {article.get('title', '')}")
        lines.append(f"    Published: {article.get('published', 'Unknown date')}")
        lines.append(f"    Summary: {summary}")
        lines.append(f"    Link: {article.get('link', '')}")
        lines.append("")

    return "\n".join(lines).rstrip()


def get_news_sentiment_keywords(articles: List[Dict]) -> Dict:
    """
    Simple keyword-based sentiment analysis on headlines (no ML model needed).
    Counts positive vs negative financial keywords.

    Positive keywords: ["surge", "rally", "gain", "growth", "beat", "record", "rise", "up", "bull", "upgrade"]
    Negative keywords: ["crash", "fall", "drop", "loss", "miss", "decline", "down", "bear", "downgrade", "risk"]

    Returns:
        {"positive_count": int, "negative_count": int, "sentiment": "bullish"|"bearish"|"neutral",
         "positive_hits": list of matching words, "negative_hits": list of matching words}
    """
    positive_keywords = ["surge", "rally", "gain", "growth", "beat", "record", "rise", "up", "bull", "upgrade"]
    negative_keywords = ["crash", "fall", "drop", "loss", "miss", "decline", "down", "bear", "downgrade", "risk"]

    combined_text = " ".join(
        article.get("title", "") + " " + article.get("summary", "")
        for article in articles
    ).lower()

    positive_hits = [word for word in positive_keywords if word in combined_text]
    negative_hits = [word for word in negative_keywords if word in combined_text]

    positive_count = len(positive_hits)
    negative_count = len(negative_hits)

    if positive_count > negative_count:
        sentiment = "bullish"
    elif negative_count > positive_count:
        sentiment = "bearish"
    else:
        sentiment = "neutral"

    return {
        "positive_count": positive_count,
        "negative_count": negative_count,
        "sentiment": sentiment,
        "positive_hits": positive_hits,
        "negative_hits": negative_hits,
    }
