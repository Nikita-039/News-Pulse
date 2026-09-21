"""
deduplicator.py — Filters out articles that already exist in MongoDB.

Deduplication key: canonical article URL.
Uses a single bulk existence check (set of known URLs) to minimise
round-trips rather than one DB query per article.
"""

import logging
from db.database import get_db

logger = logging.getLogger(__name__)


def get_existing_urls() -> set[str]:
    """Retrieve the complete set of article URLs already in the database."""
    db = get_db()
    cursor = db.articles.find({}, {"url": 1, "_id": 0})
    return {doc["url"] for doc in cursor}


def filter_new_articles(articles: list[dict]) -> tuple[list[dict], int]:
    """
    Remove articles whose URL already exists in MongoDB.

    Args:
        articles: Normalised article dicts from rss_fetcher.

    Returns:
        (new_articles, skipped_count)
        - new_articles: articles not yet in the database.
        - skipped_count: number of duplicates detected and dropped.
    """
    existing_urls = get_existing_urls()
    logger.info("Database currently has %d known article URLs.", len(existing_urls))

    new_articles: list[dict] = []
    skipped = 0

    for article in articles:
        if article["url"] in existing_urls:
            skipped += 1
            logger.debug("Duplicate skipped: %s", article["url"])
        else:
            new_articles.append(article)

    logger.info(
        "Deduplication — new: %d  duplicates: %d  total incoming: %d",
        len(new_articles), skipped, len(articles),
    )
    return new_articles, skipped
