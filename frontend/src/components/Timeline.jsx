import { useMemo } from 'react';

/**
 * CustomTimeline — A pure-React, CSS-only timeline.
 * Renders clusters as clickable horizontal bars grouped by date.
 * No third-party timeline library needed.
 */

const SOURCE_COLORS = {
  'BBC News':    { bg: 'rgba(220,38,38,0.18)',  border: 'rgba(220,38,38,0.4)',  text: '#f87171' },
  'NPR':         { bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa' },
  'The Guardian':{ bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.4)', text: '#34d399' },
};

const DEFAULT_COLOR = { bg: 'rgba(124,58,237,0.18)', border: 'rgba(124,58,237,0.4)', text: '#a78bfa' };

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
}

function groupByDate(clusters) {
  const groups = {};
  clusters.forEach((c) => {
    const d = c.startTime ? new Date(c.startTime).toDateString() : 'Unknown';
    if (!groups[d]) groups[d] = { dateKey: d, displayDate: formatDate(c.startTime), clusters: [] };
    groups[d].clusters.push(c);
  });

  // Sort date groups newest-first
  return Object.values(groups).sort(
    (a, b) => new Date(b.clusters[0].startTime) - new Date(a.clusters[0].startTime)
  );
}

export default function Timeline({ clusters, onSelectCluster, loading }) {
  const dateGroups = useMemo(() => groupByDate(clusters), [clusters]);

  const isEmpty = !loading && clusters.length === 0;

  if (loading) {
    return (
      <div className="timeline-wrap" style={{ padding: 20 }}>
        <div className="ct-skeleton-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />
          ))}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="timeline-wrap">
        <div className="timeline-empty" role="status">
          <div className="timeline-empty__icon">📰</div>
          <p className="timeline-empty__text">No clusters yet</p>
          <p className="timeline-empty__hint">Click "Refresh Data" to ingest the latest news</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ct-root" role="region" aria-label="News topic timeline">
      {dateGroups.map((group) => (
        <div key={group.dateKey} className="ct-day-group">
          {/* Date axis label */}
          <div className="ct-day-header">
            <span className="ct-day-line" aria-hidden="true" />
            <span className="ct-day-label">{group.displayDate}</span>
            <span className="ct-day-line" aria-hidden="true" />
          </div>

          {/* Cluster blocks for this day */}
          <div className="ct-cluster-list">
            {group.clusters
              .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
              .map((cluster) => {
                const primarySource = cluster.sources?.[0] || '';
                const color = SOURCE_COLORS[primarySource] || DEFAULT_COLOR;

                return (
                  <button
                    key={cluster.id}
                    id={`cluster-${cluster.id}`}
                    className="ct-cluster-block"
                    style={{
                      background: color.bg,
                      borderColor: color.border,
                    }}
                    onClick={() => onSelectCluster(cluster.id)}
                    aria-label={`Open cluster: ${cluster.label}`}
                  >
                    {/* Time pill */}
                    <span className="ct-time">{formatTime(cluster.startTime)}</span>

                    {/* Label */}
                    <span className="ct-label">{cluster.label}</span>

                    {/* Right side badges */}
                    <div className="ct-meta">
                      {cluster.sources?.map((s) => (
                        <span
                          key={s}
                          className="ct-source-badge"
                          style={{
                            color: (SOURCE_COLORS[s] || DEFAULT_COLOR).text,
                            borderColor: (SOURCE_COLORS[s] || DEFAULT_COLOR).border,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                      <span className="ct-article-count">
                        {cluster.articleCount} art.
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
