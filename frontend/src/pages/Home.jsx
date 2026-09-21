import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTimeline } from '../api/client';

import Navbar        from '../components/Navbar';
import SourceFilter  from '../components/SourceFilter';
import RefreshButton from '../components/RefreshButton';
import Timeline      from '../components/Timeline';
import ClusterPanel  from '../components/ClusterPanel';

export default function Home() {
  const [timelineData,     setTimelineData]     = useState([]);  // raw from /timeline
  const [loading,          setLoading]          = useState(true);
  const [fetchError,       setFetchError]       = useState(null);
  const [selectedCluster,  setSelectedCluster]  = useState(null);
  const [activeSources,    setActiveSources]    = useState(new Set());
  const [toast,            setToast]            = useState(null); // { msg, type }

  // ── Data fetching ────────────────────────────────────────────────────────
  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data } = await getTimeline();
      setTimelineData(data.data || []);

      // Seed activeSources with all sources seen so far
      const allSources = new Set();
      (data.data || []).forEach((c) => (c.sources || []).forEach((s) => allSources.add(s)));
      setActiveSources(allSources);
    } catch (err) {
      setFetchError(err.response?.data?.error || 'Failed to load timeline data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  // ── Source filter helpers ────────────────────────────────────────────────
  /** All unique sources across all clusters. */
  const allSources = useMemo(() => {
    const s = new Set();
    timelineData.forEach((c) => (c.sources || []).forEach((src) => s.add(src)));
    return [...s].sort();
  }, [timelineData]);

  const toggleSource = useCallback((source) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      next.has(source) ? next.delete(source) : next.add(source);
      return next;
    });
  }, []);

  /** Clusters that survive the source filter (show cluster if ANY source is active). */
  const filteredClusters = useMemo(() => {
    if (activeSources.size === 0) return timelineData;
    return timelineData.filter((c) =>
      (c.sources || []).some((s) => activeSources.has(s))
    );
  }, [timelineData, activeSources]);

  // ── Ingestion completion ─────────────────────────────────────────────────
  const handleIngestComplete = useCallback(() => {
    loadTimeline();
    showToast('Ingestion complete! Timeline updated.', 'success');
  }, [loadTimeline]);

  // ── Toast helper ─────────────────────────────────────────────────────────
  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Timeline count label ─────────────────────────────────────────────────
  const clusterLabel = loading
    ? 'Loading…'
    : `${filteredClusters.length} cluster${filteredClusters.length !== 1 ? 's' : ''}`;

  return (
    <div className="home">
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <Navbar>
        <RefreshButton onComplete={handleIngestComplete} />
      </Navbar>

      {/* ── Toolbar — source filter ─────────────────────────────────────── */}
      <div className="toolbar">
        <SourceFilter
          sources={allSources}
          activeSources={activeSources}
          onToggle={toggleSource}
        />
      </div>

      {/* ── Timeline section ────────────────────────────────────────────── */}
      <section className="timeline-section">
        <div className="timeline-header">
          <h2 id="timeline-heading">Topic Clusters</h2>
          <span className="timeline-header__count">{clusterLabel}</span>
        </div>

        {fetchError && (
          <div className="badge badge--red" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
            ⚠ {fetchError}
          </div>
        )}

        <Timeline
          clusters={filteredClusters}
          onSelectCluster={setSelectedCluster}
          loading={loading}
        />

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Click a cluster block to explore its articles · Scroll / pinch to zoom · Drag to pan
        </p>
      </section>

      {/* ── Cluster detail panel ────────────────────────────────────────── */}
      <ClusterPanel
        clusterId={selectedCluster}
        onClose={() => setSelectedCluster(null)}
      />

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className="toast-wrap" role="status" aria-live="polite">
          <div className={`toast toast--${toast.type}`}>
            {toast.type === 'success' && '✓ '}
            {toast.type === 'error'   && '✕ '}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
