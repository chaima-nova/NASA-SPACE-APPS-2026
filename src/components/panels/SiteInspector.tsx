import type { CommunityState, DataSource, Prediction } from '../../data-contracts/types';
import { photosFor } from '../../data/sitePhotos';
import { SiteCommunity, type CommunityActions } from './SiteCommunity';
import { scoreColor } from '../../lib/colors';
import {
  datasetsFor,
  FACTOR_HINTS,
  FACTOR_LABELS,
  FACTOR_ORDER,
  factorsOf,
  fitFor,
  formatCoords,
  formatElevation,
  formatScore,
  TARGET_LABELS,
  terrainLabel,
  verdictOf,
  type Target,
} from '../../lib/site';

interface SiteInspectorProps {
  prediction: Prediction | null;
  rank: number | null;
  target: Target;
  datasets: DataSource[];
  /** Field notes, reviews and upvotes for this site and its neighbours. */
  community: CommunityState;
  /** Community writes already bound to this prediction's id. */
  actions: CommunityActions;
  onExport: () => void;
  onCopyLink: () => void;
  onSeeSite: () => void;
  onCompare: () => void;
  copied: boolean;
}

function Meter({
  label,
  value,
  accent,
  active,
  hint,
}: {
  label: string;
  value: number;
  accent: string;
  active?: boolean;
  hint?: string;
}) {
  return (
    <div className={active ? 'meter is-active' : 'meter'}>
      <div className="meter-head">
        <span className="meter-label" title={hint}>
          {label}
        </span>
        <span className="meter-value">{Math.round(value * 100)}%</span>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
      >
        <span className="meter-fill" style={{ width: `${Math.max(2, value * 100)}%`, background: accent }} />
      </div>
    </div>
  );
}

/**
 * Everything a judge needs about one site, in one column: the verdict, the
 * Moon-vs-Mars split, the four brief axes, the datasets behind the numbers,
 * and an export that survives the demo.
 */
export function SiteInspector({
  prediction,
  rank,
  target,
  datasets,
  community,
  actions,
  onExport,
  onCopyLink,
  onSeeSite,
  onCompare,
  copied,
}: SiteInspectorProps) {
  if (!prediction) {
    return (
      <div className="empty">
        <p>No site selected.</p>
        <p className="empty-sub">Pick a row from the ranked list or click a beacon on the globe.</p>
      </div>
    );
  }

  const fit = fitFor(prediction, target);
  const factors = factorsOf(prediction);
  const siteDatasets = datasetsFor(prediction, datasets);
  const moonFit = fitFor(prediction, 'moon');
  const marsFit = fitFor(prediction, 'mars');
  const photoCount = photosFor(prediction).length;

  return (
    <div className="dossier">
      <div className="dossier-top">
        <span className="kicker">Site dossier</span>
        {rank !== null ? <span className="rank-chip">#{String(rank).padStart(2, '0')}</span> : null}
      </div>

      <h2 className="dossier-name">{prediction.siteName}</h2>
      <p className="dossier-meta">
        {prediction.region ?? '—'} · {terrainLabel(prediction)} ·{' '}
        {formatElevation(prediction.elevationM)}
      </p>

      <div className="dossier-score">
        <span className="dossier-score-value" style={{ color: scoreColor(fit) }}>
          {formatScore(fit)}
        </span>
        <span className="dossier-score-side">
          <span className="dossier-score-label">{TARGET_LABELS[target]} analog fit</span>
          <span className="pill">{prediction.label}</span>
        </span>
      </div>

      <div className="split">
        <Meter
          label="Moon fit"
          value={moonFit}
          accent="var(--moon)"
          active={target === 'moon'}
          hint="Fit against permanent Moon base conditions"
        />
        <Meter
          label="Mars fit"
          value={marsFit}
          accent="var(--mars)"
          active={target === 'mars'}
          hint="Fit against Martian surface conditions"
        />
      </div>

      <div className="divider" />

      <h3 className="section-title">Why this site</h3>
      <div className="factors">
        {FACTOR_ORDER.map((key) => (
          <Meter
            key={key}
            label={FACTOR_LABELS[key]}
            value={factors[key]}
            accent="var(--signal)"
            hint={FACTOR_HINTS[key]}
          />
        ))}
      </div>

      <p className="verdict">{verdictOf(prediction, target)}</p>

      <div className="site-actions">
        <button
          type="button"
          className="btn see-site"
          onClick={onSeeSite}
          disabled={photoCount === 0}
          title={
            photoCount === 0
              ? 'No field photography catalogued for this site yet'
              : `Open ${photoCount} field photos of ${prediction.siteName}`
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="see-site-icon">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.6" />
            <path d="M21 15.5 16 11l-5.5 5.5L8 14l-5 5" />
          </svg>
          <span className="see-site-label">See Site</span>
          <span className="see-site-meta">
            {photoCount > 0 ? `${photoCount} field photos` : 'No photos yet'}
          </span>
        </button>
        <button
          type="button"
          className="btn compare-open"
          onClick={onCompare}
          title="NASA satellite imagery next to the ground photograph"
        >
          Satellite-Ground Comparison
        </button>
      </div>

      <div className="divider" />

      <h3 className="section-title">
        Sources <span className="section-count">{siteDatasets.length}</span>
      </h3>
      <div className="chips chips-wrap">
        {siteDatasets.map((dataset) => (
          <a
            key={dataset.id}
            className="chip chip-link"
            href={dataset.url}
            target="_blank"
            rel="noreferrer"
            title={`${dataset.provider} · ${dataset.spatialResolution ?? '—'}`}
          >
            {dataset.instrument ?? dataset.name}
          </a>
        ))}
      </div>

      <dl className="facts">
        <div>
          <dt>Coordinates</dt>
          <dd>{formatCoords(prediction.lat, prediction.lon)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(prediction.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>
            {prediction.model.id} {prediction.model.version}
          </dd>
        </div>
      </dl>

      <SiteCommunity
        siteId={prediction.id}
        siteName={prediction.siteName}
        community={community}
        onVote={() => actions.onVote()}
        onAddNote={actions.onAddNote}
        onAddReview={actions.onAddReview}
        onDelete={actions.onDelete}
      />

      <div className="divider" />

      <div className="dossier-actions">
        <button type="button" className="btn btn-primary" onClick={onExport}>
          Export CSV
        </button>
        <button type="button" className="btn" onClick={onCopyLink}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
