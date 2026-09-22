#!/usr/bin/env python3
"""
pipeline.py — News Pulse ingestion & clustering orchestrator.

Usage:
    python pipeline.py                     # standalone run
    python pipeline.py --job-id <UUID>     # triggered by Node.js API

When --job-id is supplied the script reads/writes the ingest_jobs
collection so the Node.js status endpoint can track progress in real time.

Run from the scraper/ directory so Python resolves sub-package imports:
    cd scraper && python pipeline.py
"""

import argparse
import logging
import sys
from datetime import datetime, timezone

# ── Package imports (all relative to scraper/) ────────────────────────────────
from db.database import (
    get_db,
    insert_article,
    get_all_articles,
    drop_and_insert_clusters,
    update_article_cluster,
    upsert_ingest_job,
    close,
)
from scraper.rss_fetcher import fetch_all_feeds
from scraper.article_extractor import enrich_articles
from scraper.deduplicator import filter_new_articles
from clustering.topic_clusterer import cluster_articles

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("pipeline")


# ──────────────────────────────────────────────────────────────────────────────
# Job status helpers
# ──────────────────────────────────────────────────────────────────────────────

def _update_job(job_id: str | None, status: str, **fields) -> None:
    """Write job status to MongoDB (no-op when job_id is None)."""
    if not job_id:
        return
    doc = {"_id": job_id, "status": status, **fields}
    try:
        upsert_ingest_job(doc)
    except Exception as exc:
        logger.warning("Could not update job status: %s", exc)


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline
# ──────────────────────────────────────────────────────────────────────────────

def run_pipeline(job_id: str | None = None) -> dict:
    """
    Execute the full News Pulse pipeline:
      1. Fetch RSS feeds
      2. Deduplicate against MongoDB
      3. Extract full article content
      4. Save new articles
      5. Load ALL articles (existing + new) for clustering
      6. Cluster with TF-IDF + DBSCAN
      7. Drop old clusters, insert new ones, update article cluster_ids

    Args:
        job_id: Optional UUID from Node.js. When set, updates ingest_jobs.

    Returns:
        Summary dict with new_articles, clusters_updated, total_articles.
    """
    _update_job(job_id, "running", started_at=datetime.now(timezone.utc))

    try:
        # ── Step 1: Fetch RSS ──────────────────────────────────────────────────
        logger.info("━━━ Step 1 / 7 — Fetching RSS feeds ━━━")
        raw_articles = fetch_all_feeds()
        logger.info("Fetched %d raw articles from all feeds.", len(raw_articles))

        # ── Step 2: Deduplicate ────────────────────────────────────────────────
        logger.info("━━━ Step 2 / 7 — Deduplication ━━━")
        new_articles, skipped = filter_new_articles(raw_articles)
        logger.info("New: %d  |  Already in DB: %d", len(new_articles), skipped)

        # ── Step 3: Extract full content ───────────────────────────────────────
        if new_articles:
            logger.info("━━━ Step 3 / 7 — Extracting article content (%d articles) ━━━",
                        len(new_articles))
            new_articles = enrich_articles(new_articles)
        else:
            logger.info("Step 3 skipped — no new articles to enrich.")

        # ── Step 4: Save new articles ──────────────────────────────────────────
        logger.info("━━━ Step 4 / 7 — Saving new articles ━━━")
        saved = 0
        for article in new_articles:
            if insert_article(article):
                saved += 1
        logger.info("Saved %d new articles to MongoDB.", saved)

        # ── Step 5: Load ALL articles for clustering ───────────────────────────
        logger.info("━━━ Step 5 / 7 — Loading full article corpus ━━━")
        all_articles = get_all_articles()
        logger.info(
            "Corpus size: %d articles (existing + new).", len(all_articles)
        )

        # ── Step 6: Cluster ────────────────────────────────────────────────────
        logger.info("━━━ Step 6 / 7 — Clustering articles ━━━")
        cluster_docs, url_to_cluster_idx = cluster_articles(all_articles)
        logger.info("Generated %d clusters.", len(cluster_docs))

        # ── Step 7: Persist clusters + update articles ─────────────────────────
        logger.info("━━━ Step 7 / 7 — Persisting clusters ━━━")
        cluster_ids = drop_and_insert_clusters(cluster_docs)

        updated_articles = 0
        for article in all_articles:
            url = article.get("url", "")
            idx = url_to_cluster_idx.get(url)
            if idx is not None and idx < len(cluster_ids):
                update_article_cluster(url, cluster_ids[idx])
                updated_articles += 1

        logger.info("Updated cluster_id on %d articles.", updated_articles)

        # ── Done ───────────────────────────────────────────────────────────────
        summary = {
            "new_articles": saved,
            "clusters_updated": len(cluster_docs),
            "total_articles": len(all_articles),
        }
        _update_job(
            job_id,
            "completed",
            completed_at=datetime.now(timezone.utc),
            new_articles=saved,
            clusters_updated=len(cluster_docs),
        )
        logger.info("Pipeline finished successfully. Summary: %s", summary)
        return summary

    except Exception as exc:
        logger.error("Pipeline failed: %s", exc, exc_info=True)
        _update_job(
            job_id,
            "failed",
            completed_at=datetime.now(timezone.utc),
            error_message=str(exc),
        )
        raise


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="News Pulse — RSS ingestion and topic clustering pipeline."
    )
    parser.add_argument(
        "--job-id",
        metavar="UUID",
        default=None,
        help="Ingest job ID (supplied by Node.js /ingest/trigger endpoint).",
    )
    args = parser.parse_args()

    try:
        result = run_pipeline(job_id=args.job_id)
        print(f"\nDone ✓  {result}")
        sys.exit(0)
    except Exception as exc:
        print(f"\nPipeline error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        close()


if __name__ == "__main__":
    main()
