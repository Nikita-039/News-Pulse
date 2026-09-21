import { useIngestion } from '../hooks/useIngestion';

const STATUS_LABELS = {
  queued:    'Queued…',
  running:   'Ingesting…',
  completed: 'Done!',
  failed:    'Failed',
};

/**
 * RefreshButton — triggers the Python pipeline and shows live status.
 *
 * Props:
 *   onComplete: () => void   — called when ingestion succeeds (reload timeline)
 */
export default function RefreshButton({ onComplete }) {
  const { trigger, status, isRunning, error, summary } = useIngestion(onComplete);

  const label = isRunning
    ? (STATUS_LABELS[status] || 'Running…')
    : '↻  Refresh Data';

  let statusClass = '';
  if (status === 'completed') statusClass = 'refresh-status--done';
  else if (status === 'failed') statusClass = 'refresh-status--error';
  else if (isRunning)          statusClass = 'refresh-status--running';

  return (
    <div className="refresh-btn-wrapper">
      <button
        id="refresh-data-btn"
        className="btn btn--primary"
        onClick={trigger}
        disabled={isRunning}
        aria-label="Refresh news data by running the ingestion pipeline"
      >
        {isRunning && <span className="spinner" aria-hidden="true" />}
        {label}
      </button>

      {/* Status line */}
      {status && (
        <div className={`refresh-status ${statusClass}`} role="status" aria-live="polite">
          {isRunning && (
            <span className="pulse-dot" style={{ background: 'var(--accent-cyan)' }} aria-hidden="true" />
          )}
          {status === 'completed' && summary
            ? `+${summary.newArticles} articles · ${summary.clustersUpdated} clusters`
            : error || STATUS_LABELS[status] || status}
        </div>
      )}
    </div>
  );
}
