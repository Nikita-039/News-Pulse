/**
 * SourceFilter — pill chip toggles for each news source.
 * Controlled by parent: receives activeSources (Set) and onToggle callback.
 */
export default function SourceFilter({ sources, activeSources, onToggle }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="source-filter" role="group" aria-label="Filter by news source">
      <span className="source-filter__label">Sources</span>
      {sources.map((source) => {
        const isActive = activeSources.has(source);
        return (
          <button
            key={source}
            id={`source-chip-${source.replace(/\s+/g, '-').toLowerCase()}`}
            className={`source-chip ${isActive ? 'source-chip--active' : ''}`}
            onClick={() => onToggle(source)}
            aria-pressed={isActive}
            title={isActive ? `Hide ${source}` : `Show ${source}`}
          >
            <span className="source-chip__dot" aria-hidden="true" />
            {source}
          </button>
        );
      })}
    </div>
  );
}
