import type {
  CommunityState,
  DataSource,
  EvidenceState,
  Prediction,
} from '../../data-contracts/types';
import { photosFor, photoUrl } from '../../data/sitePhotos';
import { terrainMeasurementFor } from '../../services/pipeline';
import { SiteCommunity, type CommunityActions } from './SiteCommunity';
import { scoreColor } from '../../lib/colors';
import { sourceUrl } from '../../lib/sourceLinks';
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
  /** Opens the Plan My Trip route planner for this site. */
  onPlanTrip: () => void;
  /** Opens the side-by-side comparison against another scored site. */
  onCompareSites: () => void;
  onCopyLink: () => void;
  onSeeSite: () => void;
  onCompare: () => void;
  copied: boolean;
  /** Whether the dossier is opened out across the page. */
  expanded: boolean;
  onToggleExpand: () => void;
}

/**
 * The engine's four states as a reader should meet them.
 *
 * The data-contract words are kept verbatim in the payload and the interface
 * says what they mean: `insufficient_evidence` is "incomplete", not "bad", and
 * the difference is the whole point of carrying the state rather than a number.
 */
const EVIDENCE_LABELS: Record<EvidenceState, string> = {
  similar: 'Evidence: similar',
  different: 'Evidence: different',
  insufficient_evidence: 'Evidence: incomplete',
  not_comparable: 'Evidence: not comparable',
};

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
  onPlanTrip,
  onCompareSites,
  onCopyLink,
  onSeeSite,
  onCompare,
  copied,
  expanded,
  onToggleExpand,
}: SiteInspectorProps) {
  if (!prediction) {
    return (
      <div className="empty">
        <p>No site selected.</p>
        <p className="empty-sub">Pick a row from the ranked list or click a beacon on the globe.</p>
        {/* Still offered when there is nothing to show: an opened dossier that
            lost its selection must not trap the reader in an empty overlay. */}
        {expanded ? (
          <button type="button" className="dossier-expand" onClick={onToggleExpand}>
            Collapse
          </button>
        ) : null}
      </div>
    );
  }

  const fit = fitFor(prediction, target);
  const factors = factorsOf(prediction);
  const siteDatasets = datasetsFor(prediction, datasets);
  const moonFit = fitFor(prediction, 'moon');
  const marsFit = fitFor(prediction, 'mars');
  const photos = photosFor(prediction);
  const photoCount = photos.length;
  const terrain = terrainMeasurementFor(prediction.pointId);

  return (
    <div className="dossier">
      <div className="dossier-top">
        <span className="kicker">Site dossier</span>
        <span className="dossier-top-right">
          {rank !== null ? (
            <span className="rank-chip">#{String(rank).padStart(2, '0')}</span>
          ) : null}
          <button
            type="button"
            className="dossier-expand"
            aria-pressed={expanded}
            onClick={onToggleExpand}
            title={
              expanded
                ? 'Return the dossier to its column'
                : 'Open the dossier across the page to read it'
            }
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </span>
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
          label="Moon Fit"
          value={moonFit}
          accent="var(--moon)"
          active={target === 'moon'}
          hint="Fit against permanent Moon base conditions"
        />
        <Meter
          label="Mars Fit"
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

      {/* The engine's state, where one exists. The rail carried this badge but
          the opened dossier did not, so a reader who clicked through to make the
          decision met the score without its qualifier. */}
      {prediction.evidence ? (
        <div className={`evidence-row is-${prediction.evidence}`}>
          <span className="evidence-badge">{EVIDENCE_LABELS[prediction.evidence]}</span>
          {prediction.evidenceNote ? (
            <p className="evidence-text">{prediction.evidenceNote}</p>
          ) : null}
        </div>
      ) : null}

      {/* The ground under the site, measured from SRTM rather than typed into a
          fixture. Only the curated sites have a row; a screened cell carries its
          own measurement in its evidence note instead. */}
      {terrain ? (
        terrain.status === 'measured' &&
        terrain.measured &&
        terrain.windowCentre &&
        terrain.cellMetres ? (
          <div>
            <h3 className="section-title">
              Measured ground <span className="section-count">SRTM {terrain.tile}</span>
            </h3>
            <dl className="facts">
              <div>
                <dt>Mean slope</dt>
                <dd>{terrain.measured.slopeMeanDeg}°</dd>
              </div>
              <div>
                <dt>Steepest cell</dt>
                <dd>{terrain.measured.slopeMaxDeg}°</dd>
              </div>
              <div>
                <dt>Roughness (TRI)</dt>
                <dd>{terrain.measured.triMeanM} m</dd>
              </div>
              <div>
                <dt>Relief</dt>
                <dd>{Math.round(terrain.measured.reliefM).toLocaleString('en-US')} m</dd>
              </div>
            </dl>
            <p className="measured-note">
              {`Measured at ${terrain.cellMetres.northSouth} m over a ${((terrain.measured.windowCells * terrain.cellMetres.northSouth) / 1000).toFixed(1)} km window ` +
                `${
                  terrain.windowCentre.offsetKm >= 0.5
                    ? `${terrain.windowCentre.offsetKm} km from the site coordinate`
                    : 'centred on the site coordinate'
                }. Slope, roughness and relief only — aridity, dust and mineralogy stay model assumptions.`}
            </p>
          </div>
        ) : (
          <p className="measured-note">{terrain.reason}</p>
        )
      ) : null}

      {/* One honest sentence rather than a half-model. A south polar site lives
          or dies on lighting, and nothing in this build can compute it. */}
      {target === 'moon' ? (
        <p className="dossier-caveat">
          Illumination is not part of this score: a permanent south polar base depends on
          horizon-scale sunlight and direct Earth visibility, and this build models neither.
        </p>
      ) : null}

      <div className="site-actions">
        <button
          type="button"
          className={photos.length > 0 ? 'btn see-site has-photo' : 'btn see-site'}
          onClick={onSeeSite}
          disabled={photoCount === 0}
          /* The first frame is the card's background, faded behind the label,
             so the row carries the ground itself rather than a picture icon
             standing in for it. The gradient keeps the label readable over a
             bright frame; the gallery prints the credit and licence in full,
             and the tooltip names the photographer for the frame behind it. */
          style={
            photos.length > 0
              ? {
                  backgroundImage:
                    'linear-gradient(90deg, rgba(6, 10, 18, 0.95), rgba(6, 10, 18, 0.82) 52%, rgba(6, 10, 18, 0.75)), ' +
                    'url(' + photoUrl(photos[0], 640) + ')',
                }
              : undefined
          }
          title={
            photoCount === 0
              ? 'No field photography catalogued for this site yet'
              : `Open ${photoCount} field photos of ${prediction.siteName} — first frame by ${photos[0].credit} (${photos[0].license})`
          }
        >
          {/* The glyph is the fallback, not the rule: with photography the frame
              itself does this job and a second picture mark on top of it is noise. */}
          {photos.length === 0 ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="see-site-icon">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="M21 15.5 16 11l-5.5 5.5L8 14l-5 5" />
            </svg>
          ) : null}
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
          {/* The reference mark, traced to its proportions: a body with a cap on
              its upper end, wide solar wings with a cell divider, the dish beyond
              the body's lower end and two signal arcs outside that. Drawn upright
              and rotated 45°, which is what puts the panels across opposite
              corners. The wings carry one divider rather than the reference's
              eight cells: at 16 px a panel is about 2 px deep and a finer grid
              turns to noise. */}
          <svg viewBox="0 0 24 24" aria-hidden="true" className="compare-icon">
            {/* The mark is asymmetric, so the rotation alone leaves its ink off
                centre; the shift recentres it in the 16 px box. */}
            <g transform="translate(-1.15 1.1) rotate(45 12 12)">
              <rect x="10.2" y="5.3" width="2.9" height="1.7" rx="0.7" />
              <rect x="9.95" y="6.9" width="4.1" height="6" rx="1.2" />
              <rect x="3.4" y="8.45" width="5.5" height="3.65" rx="0.9" />
              <rect x="15.1" y="8.45" width="5.5" height="3.65" rx="0.9" />
              <path d="M6.15 9.4v1.75" />
              <path d="M17.85 9.4v1.75" />
              <path d="M8.9 10.28h1.05" />
              <path d="M14.05 10.28h1.05" />
              <path d="M12 12.9v0.6" />
              <path d="M9.3 15.25C9.7 14.2 10.7 13.5 12 13.5C13.3 13.5 14.3 14.2 14.7 15.25Z" />
              <path d="M12 15.25v1.2" />
              <path d="M10.4 16.9A2.6 2.6 0 0 1 13.6 16.9" />
              <path d="M9.7 17.8A3.2 3.2 0 0 1 13.9 17.8" />
            </g>
          </svg>
          <span className="compare-label">
            Satellite{' '}
            <span className="compare-arrow">↔</span>{' '}
            Ground Comparison
          </span>
        </button>
      </div>

      <div className="divider" />

      <h3 className="section-title">
        Sources <span className="section-count">{siteDatasets.length}</span>
      </h3>
      <div className="chips chips-wrap">
        {siteDatasets.map((dataset) => {
          const href = sourceUrl(dataset);
          const label = dataset.instrument || dataset.name;
          const hint = [dataset.provider, dataset.spatialResolution]
            .filter(Boolean)
            .join(' · ');
          return href ? (
            <a
              key={dataset.id}
              className="chip chip-link"
              href={href}
              target="_blank"
              rel="noreferrer"
              title={hint}
            >
              {label}
            </a>
          ) : (
            <span key={dataset.id} className="chip" title={hint}>
              {label}
            </span>
          );
        })}
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
        {/* Export and the copy-link action belong together: you export what is
            on screen, or you share the permalink to it. The comparison question
            is the longer one, so it keeps a row of its own underneath. */}
        {/* The way out runs the full width above them, not beside them: a party
            planning a field season settles how it gets there before what it
            exports, and the strip gives that decision the weight it has. */}
        <button type="button" className="btn btn-primary dossier-trip" onClick={onPlanTrip}>
          Plan My Trip
        </button>
        <div className="dossier-export">
          <button type="button" className="btn btn-primary" onClick={onExport}>
            Export
          </button>
          <button type="button" className="btn btn-primary" onClick={onCopyLink}>
            {copied ? 'Link Copied' : 'Copy Link'}
          </button>
          <button
            type="button"
            className="btn btn-primary dossier-compare"
            onClick={onCompareSites}
          >
            Compare Analogue Sites
          </button>
        </div>
      </div>
    </div>
  );
}
