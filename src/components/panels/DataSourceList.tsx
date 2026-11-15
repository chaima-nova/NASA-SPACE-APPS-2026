import type { DataSource, FocusArea } from '../../data-contracts/types';
import { sourceUrl } from '../../lib/sourceLinks';

interface DataSourceListProps {
  datasets: DataSource[];
}

const FOCUS_LABELS: Record<FocusArea, string> = {
  'moon-base-analog': 'Moon base analog',
  'mars-base-analog': 'Mars base analog',
  'dual-analog': 'Dual analog',
};

/**
 * Read-only view of the NASA datasets catalogued by Abid.
 *
 * Each name links to the dataset's own landing page, because the point of the
 * card is provenance: a reader should be able to check a source rather than take
 * the label on trust. The link opens in a new tab so the workbench, and whatever
 * site was selected in it, survives the visit — hence `noreferrer` too. A dataset
 * with no page on record keeps its plain name.
 */
export function DataSourceList({ datasets }: DataSourceListProps) {
  return (
    <ul className="source-list">
      {datasets.map((dataset) => {
        const href = sourceUrl(dataset);
        return (
          <li key={dataset.id}>
            {href ? (
              <a
                className="source-name source-link"
                href={href}
                target="_blank"
                rel="noreferrer"
                title={`Open ${dataset.name} at the source`}
              >
                {dataset.name}
                <span className="source-link-mark" aria-hidden="true">
                  ↗
                </span>
              </a>
            ) : (
              <div className="source-name">{dataset.name}</div>
            )}
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
        );
      })}
    </ul>
  );
}
