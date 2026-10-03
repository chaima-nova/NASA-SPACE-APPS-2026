import type { DataSource, FocusArea } from '../../data-contracts/types';

interface DataSourceListProps {
  datasets: DataSource[];
}

const FOCUS_LABELS: Record<FocusArea, string> = {
  'moon-base-analog': 'Moon base analog',
  'mars-base-analog': 'Mars base analog',
  'dual-analog': 'Dual analog',
};

/** Read-only view of the NASA datasets catalogued by Abid. */
export function DataSourceList({ datasets }: DataSourceListProps) {
  return (
    <ul className="source-list">
      {datasets.map((dataset) => (
        <li key={dataset.id}>
          <div className="source-name">{dataset.name}</div>
          <div className="source-meta">
            {dataset.provider}
            {dataset.instrument ? ` · ${dataset.instrument}` : ''}
          </div>
          <div className="source-meta">
            {dataset.spatialResolution ?? '—'} · {dataset.temporalResolution ?? '—'}
          </div>
          <div className="source-tags">
            {dataset.focusAreas.map((area) => (
              <span key={area} className="tag">
                {FOCUS_LABELS[area] ?? area}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
