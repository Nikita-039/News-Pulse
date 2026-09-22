"""
topic_clusterer.py — Groups articles into topic clusters using TF-IDF + DBSCAN.

Algorithm:
  1. Concatenate title + summary for each article.
  2. Vectorise with TfidfVectorizer (stop_words='english', bigrams, max 5 000 features).
  3. Compute pairwise cosine similarity → convert to distance: dist = 1 − cos_sim.
  4. Run DBSCAN(metric="precomputed") on the precomputed distance matrix.
  5. Noise articles (label −1) each become their own singleton cluster.
  6. Cluster label = top-3 TF-IDF terms of the cluster centroid.

WHY TF-IDF + DBSCAN:
  • No need to pre-specify K (unlike k-means).
  • Naturally handles noise / singleton stories.
  • cosine similarity on TF-IDF vectors is well-suited to short news texts.

IMPORTANT — Re-run correctness:
  This function must be called with ALL articles from MongoDB (existing +
  newly ingested). The pipeline drops and rewrites all cluster docs on every
  run so assignments are always globally consistent.

Parameters (tunable via env):
  DBSCAN_EPS        default 0.55  — distance threshold for same-cluster
  DBSCAN_MIN_SAMPLES default 2   — minimum cluster size
"""

import os
import logging
from datetime import datetime, timezone

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN

logger = logging.getLogger(__name__)

DBSCAN_EPS = float(os.getenv("DBSCAN_EPS", "0.85"))
DBSCAN_MIN_SAMPLES = int(os.getenv("DBSCAN_MIN_SAMPLES", "2"))


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def cluster_articles(articles: list[dict]) -> tuple[list[dict], dict[str, int]]:
    """
    Cluster all articles into topic groups.

    Args:
        articles: Full list of article dicts from MongoDB
                  (must include ALL existing + newly ingested).

    Returns:
        cluster_docs   — list of dicts ready for db.drop_and_insert_clusters()
        url_to_idx     — maps each article URL to its cluster's index in cluster_docs
    """
    if not articles:
        logger.warning("No articles to cluster.")
        return [], {}

    if len(articles) == 1:
        doc = _build_cluster_doc(articles, [], None, [0])
        return [doc], {articles[0]["url"]: 0}

    texts = _build_texts(articles)
    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=5_000,
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
    except ValueError as exc:
        logger.error("TF-IDF vectorisation failed (%s) — falling back to singletons.", exc)
        return _singleton_clusters(articles)

    # Distance matrix: dist = 1 − cosine_similarity, clipped to [0, 1]
    sim_matrix = cosine_similarity(tfidf_matrix)
    dist_matrix = np.clip(1.0 - sim_matrix, 0.0, 1.0).astype(np.float64)

    # DBSCAN on precomputed distances
    dbscan = DBSCAN(
        eps=DBSCAN_EPS,
        min_samples=DBSCAN_MIN_SAMPLES,
        metric="precomputed",
        n_jobs=-1,
    )
    labels = dbscan.fit_predict(dist_matrix)

    n_clusters = len(set(labels) - {-1})
    n_noise = int((labels == -1).sum())
    logger.info(
        "DBSCAN result — clusters: %d  noise/singletons: %d  total articles: %d",
        n_clusters, n_noise, len(articles),
    )

    feature_names = vectorizer.get_feature_names_out()
    return _build_output(articles, labels, tfidf_matrix, feature_names)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _build_texts(articles: list[dict]) -> list[str]:
    """Concatenate title + summary (or content fallback) for each article."""
    texts = []
    for a in articles:
        title = a.get("title") or ""
        body = a.get("summary") or a.get("content") or ""
        texts.append(f"{title} {body}".strip())
    return texts


def _build_output(
    articles: list[dict],
    labels: np.ndarray,
    tfidf_matrix,
    feature_names: np.ndarray,
) -> tuple[list[dict], dict[str, int]]:
    """Convert DBSCAN labels → cluster docs and URL→cluster_index map."""

    # Group article indices by label
    label_to_indices: dict[int, list[int]] = {}
    for idx, label in enumerate(labels):
        label_to_indices.setdefault(int(label), []).append(idx)

    cluster_docs: list[dict] = []
    url_to_idx: dict[str, int] = {}

    for label, indices in label_to_indices.items():
        group = [articles[i] for i in indices]

        if label == -1:
            # Each noise article → singleton cluster
            for art, idx in zip(group, indices):
                cluster_idx = len(cluster_docs)
                cluster_docs.append(
                    _build_cluster_doc([art], feature_names, tfidf_matrix, [idx])
                )
                url_to_idx[art["url"]] = cluster_idx
        else:
            cluster_idx = len(cluster_docs)
            cluster_docs.append(
                _build_cluster_doc(group, feature_names, tfidf_matrix, indices)
            )
            for art in group:
                url_to_idx[art["url"]] = cluster_idx

    return cluster_docs, url_to_idx


def _build_cluster_doc(
    articles: list[dict],
    feature_names: np.ndarray,
    tfidf_matrix,           # sparse matrix or None
    indices: list[int],
) -> dict:
    """Construct a single cluster document for MongoDB insertion."""
    label = _generate_label(feature_names, tfidf_matrix, indices)

    times = [
        a["published_at"]
        for a in articles
        if isinstance(a.get("published_at"), datetime)
    ]
    now = datetime.now(timezone.utc)
    start_time = min(times) if times else now
    end_time = max(times) if times else now

    return {
        "label": label,
        "article_count": len(articles),
        "start_time": start_time,
        "end_time": end_time,
        "sources": sorted(set(a.get("source", "") for a in articles)),
        "created_at": now,
    }


def _generate_label(
    feature_names: np.ndarray,
    tfidf_matrix,
    indices: list[int],
) -> str:
    """Return 'Word1 / Word2 / Word3' from the cluster centroid's top TF-IDF terms."""
    if tfidf_matrix is None or len(feature_names) == 0:
        return "Uncategorized"

    centroid = np.asarray(tfidf_matrix[indices].mean(axis=0)).flatten()
    top_indices = centroid.argsort()[-3:][::-1]
    words = [feature_names[i] for i in top_indices if centroid[i] > 0]
    return " / ".join(w.title() for w in words) if words else "Uncategorized"


def _singleton_clusters(articles: list[dict]) -> tuple[list[dict], dict[str, int]]:
    """Fallback: one cluster per article (used when TF-IDF fails)."""
    cluster_docs = []
    url_to_idx = {}
    now = datetime.now(timezone.utc)
    for i, art in enumerate(articles):
        cluster_docs.append({
            "label": (art.get("title") or "Article")[:60],
            "article_count": 1,
            "start_time": art.get("published_at", now),
            "end_time": art.get("published_at", now),
            "sources": [art.get("source", "")],
            "created_at": now,
        })
        url_to_idx[art["url"]] = i
    return cluster_docs, url_to_idx
