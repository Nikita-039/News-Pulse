"""
database.py — MongoDB Atlas connection and CRUD operations for News Pulse.

All Python pipeline modules import from here. Uses PyMongo directly
(no ODM) for maximum control over BSON types.
"""

import os
import logging
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MONGODB_URI = os.getenv("MONGODB_URI", "")
DB_NAME = os.getenv("DB_NAME", "news_pulse")

_client: MongoClient | None = None
_db = None


# ──────────────────────────────────────────────────────────────────────────────
# Connection management
# ──────────────────────────────────────────────────────────────────────────────

def get_db():
    """Return (and lazily create) the MongoDB database handle."""
    global _client, _db
    if _db is None:
        if not MONGODB_URI:
            raise EnvironmentError(
                "MONGODB_URI is not set. Copy scraper/.env.example to scraper/.env "
                "and paste your Atlas connection string."
            )
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
        _db = _client[DB_NAME]
        _ensure_indexes()
        logger.info("Connected to MongoDB Atlas — database: %s", DB_NAME)
    return _db


def _ensure_indexes():
    """Create indexes idempotently on first connection."""
    db = _db
    db.articles.create_index([("url", ASCENDING)], unique=True)
    db.articles.create_index([("published_at", ASCENDING)])
    db.articles.create_index([("cluster_id", ASCENDING)])
    db.clusters.create_index([("created_at", ASCENDING)])
    db.ingest_jobs.create_index([("_id", ASCENDING)])


def close():
    """Close the MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("MongoDB connection closed.")


# ──────────────────────────────────────────────────────────────────────────────
# Articles
# ──────────────────────────────────────────────────────────────────────────────

def article_exists(url: str) -> bool:
    """Return True if an article with this URL already exists."""
    db = get_db()
    return db.articles.find_one({"url": url}, {"_id": 1}) is not None


def insert_article(article: dict) -> bool:
    """
    Insert a new article document.
    Returns True if inserted, False if duplicate (URL already exists).
    """
    db = get_db()
    try:
        db.articles.insert_one(article)
        return True
    except DuplicateKeyError:
        return False


def get_all_articles() -> list[dict]:
    """
    Retrieve all articles needed for clustering.
    Returns only the fields required by topic_clusterer — keeps memory lean.
    """
    db = get_db()
    projection = {
        "_id": 1,
        "url": 1,
        "title": 1,
        "source": 1,
        "summary": 1,
        "content": 1,
        "published_at": 1,
    }
    return list(db.articles.find({}, projection))


# ──────────────────────────────────────────────────────────────────────────────
# Clusters
# ──────────────────────────────────────────────────────────────────────────────

def drop_and_insert_clusters(clusters: list[dict]) -> list[ObjectId]:
    """
    Atomically replace all cluster documents.
    Drops the existing clusters collection and inserts fresh ones.
    Returns the list of newly inserted ObjectIds (preserves insertion order).
    """
    db = get_db()
    db.clusters.drop()
    if not clusters:
        logger.warning("No clusters to insert.")
        return []
    result = db.clusters.insert_many(clusters)
    logger.info("Inserted %d clusters into MongoDB.", len(result.inserted_ids))
    return result.inserted_ids  # list[ObjectId]


def update_article_cluster(url: str, cluster_id: ObjectId) -> None:
    """Set the cluster_id field on a single article identified by URL."""
    db = get_db()
    db.articles.update_one({"url": url}, {"$set": {"cluster_id": cluster_id}})


# ──────────────────────────────────────────────────────────────────────────────
# Ingest Jobs
# ──────────────────────────────────────────────────────────────────────────────

def upsert_ingest_job(job: dict) -> None:
    """
    Create or replace an ingest job document.
    `job` must contain `_id` (the UUID string from Node.js).
    """
    db = get_db()
    db.ingest_jobs.replace_one({"_id": job["_id"]}, job, upsert=True)


def get_ingest_job(job_id: str) -> dict | None:
    """Return the ingest job document for job_id, or None if not found."""
    db = get_db()
    return db.ingest_jobs.find_one({"_id": job_id})
