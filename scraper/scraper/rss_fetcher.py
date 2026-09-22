"""
rss_fetcher.py — Fetches articles from configured RSS feeds and normalises them.

RSS sources used:
  1. BBC News  — https://feeds.bbci.co.uk/news/rss.xml
  2. NPR News  — https://feeds.npr.org/1001/rss.xml
  3. The Guardian (World) — https://www.theguardian.com/world/rss
"""

import logging
import feedparser

from scraper.normalizer import normalize_entry

logger = logging.getLogger(__name__)

# ─── Feed registry ────────────────────────────────────────────────────────────
RSS_FEEDS: dict[str, str] = {
    "BBC News": "https://feeds.bbci.co.uk/news/rss.xml",
    "NPR": "https://feeds.npr.org/1001/rss.xml",
    "The Guardian": "https://www.theguardian.com/world/rss",
}


def fetch_feed(source_name: str, feed_url: str) -> list[dict]:
    """
    Fetch one RSS feed and return a list of normalised article dicts.
    Logs a warning on parse errors but never raises — the pipeline
    continues with the remaining feeds.
    """
    logger.info("Fetching  %-16s  %s", source_name, feed_url)
    try:
        feed = feedparser.parse(feed_url, agent="NewsPulse/1.0")

        if feed.bozo:
            logger.warning(
                "Feed '%s' reported a parse issue: %s",
                source_name,
                feed.bozo_exception,
            )

        articles = []
        for entry in feed.entries:
            article = normalize_entry(entry, source_name)
            if article["url"] and article["title"]:
                articles.append(article)
            else:
                logger.debug("Skipping entry with missing url/title from %s", source_name)

        logger.info("  -> %d articles from %s", len(articles), source_name)
        return articles

    except Exception as exc:
        logger.error("Failed to fetch feed '%s': %s", source_name, exc)
        return []


def fetch_all_feeds(feeds: dict[str, str] | None = None) -> list[dict]:
    """
    Fetch all configured RSS feeds and return a combined, deduplicated
    (by URL) list of normalised article dicts.

    Args:
        feeds: Optional override dict {source_name: url}.
               Defaults to RSS_FEEDS.
    """
    feeds = feeds or RSS_FEEDS
    seen_urls: set[str] = set()
    all_articles: list[dict] = []

    for source_name, feed_url in feeds.items():
        for article in fetch_feed(source_name, feed_url):
            if article["url"] not in seen_urls:
                seen_urls.add(article["url"])
                all_articles.append(article)
            else:
                logger.debug("In-memory duplicate skipped: %s", article["url"])

    logger.info("Total raw articles fetched: %d", len(all_articles))
    return all_articles
