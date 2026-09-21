"""
normalizer.py — Converts a raw feedparser entry into the canonical
News Pulse article schema, regardless of the feed's original format.
"""

import re
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import mktime, struct_time

logger = logging.getLogger(__name__)

# HTML tag stripper
_HTML_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    text = _HTML_RE.sub(" ", text)
    return " ".join(text.split()).strip()


def _parse_date(entry) -> datetime:
    """
    Try several feedparser date fields and formats.
    Falls back to UTC now so published_at is always set.
    """
    # feedparser pre-parses these into struct_time if it recognises the format
    for attr in ("published_parsed", "updated_parsed", "created_parsed"):
        value = getattr(entry, attr, None)
        if value and isinstance(value, struct_time):
            try:
                ts = mktime(value)
                return datetime.fromtimestamp(ts, tz=timezone.utc)
            except (OverflowError, OSError):
                pass

    # Some feeds expose raw date strings — try RFC 2822
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None) or entry.get(attr, None)
        if raw:
            try:
                return parsedate_to_datetime(raw).astimezone(timezone.utc)
            except Exception:
                pass

    logger.debug("Could not parse date for entry; defaulting to now.")
    return datetime.now(timezone.utc)


def _extract_summary(entry) -> str:
    """
    Pull the best available text from a feedparser entry.
    Priority: content:encoded → description → summary → "".
    All are stripped of HTML and capped at 2 000 characters.
    """
    # content:encoded (MediaRSS / full-text feeds)
    content_list = getattr(entry, "content", None)
    if content_list:
        raw = content_list[0].get("value", "")
        if raw:
            return _strip_html(raw)[:2_000]

    # <description> or feedparser's .description property
    description = getattr(entry, "description", None) or entry.get("description", "")
    if description:
        return _strip_html(description)[:2_000]

    # feedparser .summary property
    summary = getattr(entry, "summary", None) or entry.get("summary", "")
    return _strip_html(summary)[:2_000]


def normalize_entry(entry, source_name: str) -> dict:
    """
    Normalise a feedparser entry dict/object into the canonical article schema.

    Returns:
        dict with keys: title, url, source, summary, published_at,
                        content (None — filled later by article_extractor),
                        cluster_id (None — filled later by pipeline),
                        created_at.
    """
    title = _strip_html(getattr(entry, "title", "") or entry.get("title", "")).strip()
    url = (getattr(entry, "link", "") or entry.get("link", "")
           or getattr(entry, "id", "") or entry.get("id", "")).strip()

    return {
        "title": title,
        "url": url,
        "source": source_name,
        "summary": _extract_summary(entry),
        "published_at": _parse_date(entry),
        "content": None,       # enriched by article_extractor
        "cluster_id": None,    # set after clustering
        "created_at": datetime.now(timezone.utc),
    }
