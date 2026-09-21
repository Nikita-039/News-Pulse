"""
article_extractor.py — Fetches full article body text from each article URL.

Uses trafilatura as the primary extractor (best accuracy for news pages).
Falls back gracefully to the RSS summary so one failure never blocks the run.
"""

import logging
import trafilatura
from trafilatura.settings import use_config

logger = logging.getLogger(__name__)

# ── trafilatura config: fast mode, no comments/tables ────────────────────────
_traf_config = use_config()
_traf_config.set("DEFAULT", "EXTRACTION_TIMEOUT", "15")

MAX_CONTENT_LENGTH = 15_000   # characters


def extract_content(url: str) -> str | None:
    """
    Download and extract the main body text of an article page.

    Returns:
        Extracted text string (stripped), or None if extraction fails
        or yields insufficient content (< 100 chars).
    """
    try:
        downloaded = trafilatura.fetch_url(url, config=_traf_config)
        if not downloaded:
            logger.debug("Nothing downloaded from %s", url)
            return None

        text = trafilatura.extract(
            downloaded,
            config=_traf_config,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
        )
        if text and len(text.strip()) >= 100:
            return text.strip()[:MAX_CONTENT_LENGTH]

        logger.debug("Extracted text too short for %s", url)
        return None

    except Exception as exc:
        logger.warning("Extraction error for %s: %s", url, exc)
        return None


def enrich_articles(articles: list[dict]) -> list[dict]:
    """
    Attempt full-content extraction for every article.
    On failure, leaves article['content'] as the RSS summary.
    Processes sequentially — avoids rate-limiting issues on news sites.

    Args:
        articles: List of normalised article dicts (from rss_fetcher).

    Returns:
        The same list with 'content' field populated.
    """
    total = len(articles)
    success = 0
    fallback = 0

    for i, article in enumerate(articles, 1):
        url = article.get("url", "")
        logger.info("[%d/%d] Extracting: %s", i, total, article.get("title", url)[:60])

        content = extract_content(url)
        if content:
            article["content"] = content
            success += 1
        else:
            # Fall back to RSS summary — always present from normaliser
            article["content"] = article.get("summary") or ""
            fallback += 1
            logger.debug("Using RSS summary fallback for: %s", url)

    logger.info(
        "Content extraction complete — full: %d  fallback: %d  total: %d",
        success, fallback, total,
    )
    return articles
