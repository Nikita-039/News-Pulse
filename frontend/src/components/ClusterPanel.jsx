import { useEffect, useState } from 'react';
import { getCluster } from '../api/client';

/**
 * Format an ISO date string to a human-readable local time.
 */
function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/**
 * ClusterPanel — slide-in detail panel.
 *
 * Props:
 *   clusterId  {string | null}
 *   onClose    {() => void}
 */
export default function ClusterPanel({ clusterId, onClose }) {
  const [cluster, setCluster] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!clusterId) { setCluster(null); return; }

    setLoading(true);
    setError(null);

    getCluster(clusterId)
      .then(({ data }) => { setCluster(data); })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load cluster.');
      })
      .finally(() => setLoading(false));
  }, [clusterId]);

  if (!clusterId) return null;

  return (
    <>
      {/* Click-outside overlay */}
      <div className="panel-overlay" onClick={onClose} aria-hidden="true" />

      <aside
        className="cluster-panel"
        role="complementary"
        aria-label="Cluster detail panel"
      >
        {/* Header */}
        <div className="panel-header">
          <div className="panel-header__info">
            {cluster ? (
              <>
                <div className="panel-header__label">{cluster.label}</div>
                <div className="panel-header__meta">
                  <span className="badge badge--cyan">
                    {cluster.articleCount} article{cluster.articleCount !== 1 ? 's' : ''}
                  </span>
                  {(cluster.sources || []).map((s) => (
                    <span key={s} className="badge badge--purple">{s}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 8 }} />
            )}
          </div>
          <button
            id="cluster-panel-close"
            className="panel-close"
            onClick={onClose}
            aria-label="Close cluster panel"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="panel-body">
          {loading && (
            <div className="panel-loading">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton" style={{ height: 88 }} />
              ))}
            </div>
          )}

          {error && (
            <div className="badge badge--red" style={{ padding: '10px 14px', fontSize: '0.82rem' }}>
              ⚠ {error}
            </div>
          )}

          {!loading && !error && cluster?.articles?.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No articles found for this cluster.
            </p>
          )}

          {!loading && !error && cluster?.articles?.map((article, idx) => (
            <div key={idx} className="article-card fade-in">
              <div className="article-card__title">
                <a href={article.url} target="_blank" rel="noopener noreferrer">
                  {article.title || 'Untitled'}
                </a>
              </div>
              <div className="article-card__meta">
                <span className="article-card__source">{article.source}</span>
                <span className="article-card__time">{formatTime(article.publishedAt)}</span>
              </div>
              {article.summary && (
                <p className="article-card__summary">{article.summary}</p>
              )}
              <a
                className="article-card__link"
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Read full article: ${article.title}`}
              >
                Read article →
              </a>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
