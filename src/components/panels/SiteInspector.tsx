import { useState } from 'react';
import type {
  CommunityState,
  DataSource,
  Prediction,
} from '../../data-contracts/types';
import { photosFor, photoUrl } from '../../data/sitePhotos';
import { terrainMeasurementFor } from '../../services/pipeline';
import { SiteCommunity, type CommunityActions } from './SiteCommunity';
import { sourceUrl } from '../../lib/sourceLinks';
import {
  classificationSummary,
  classifySite,
  STATE_LABELS,
  type DimensionVerdict,
} from '../../lib/classification';
import {
  SIMILARITY_KIND_LABELS,
  similarityFor,
  type DimensionSimilarity,
} from '../../lib/similarity';
import { UncertaintyDialog } from './UncertaintyDialog';
import {
  datasetsFor,
  formatCoords,
  foundByTerraNexus,
  formatElevation,
  TARGET_LABELS,
  terrainLabel,
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
  /** Opens the side-by-side comparison against another classified site. */
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
 * One dimension, as the dossier states it.
 *
 * The verdict is a word; the percentage is the ratio behind it, with the ± that
 * belongs to that ratio. A prediction is labelled as one in the same row, so a
 * number built on a substituted envelope can never pass for a measurement.
 */
function DimensionBlock({
  verdict,
  similarity,
  onExplain,
  muted = false,
}: {
  verdict: DimensionVerdict;
  similarity: DimensionSimilarity;
  onExplain: () => void;
  /** Listed under the matches rather than highlighted with them. */
  muted?: boolean;
}) {
  return (
    <div className={`dimension is-${verdict.state}${muted ? ' is-muted' : ''}`}>
      <div className="dimension-head">
        <span className="dimension-label">{verdict.label}</span>
        <span className={`state-badge is-${verdict.state}`}>{STATE_LABELS[verdict.state]}</span>
      </div>
      <div className={`dimension-sim is-${similarity.kind}`}>
        {similarity.percent === null || !similarity.uncertainty ? (
          <span className="sim-none">{SIMILARITY_KIND_LABELS.incomparable}</span>
        ) : (
          <>
            <span className={`sim-value is-${similarity.kind}`}>
              {Math.round(similarity.percent)}%
            </span>
            <span className={`sim-kind is-${similarity.kind}`}>
              {SIMILARITY_KIND_LABELS[similarity.kind]}
            </span>
            <button
              type="button"
              className="sim-uncertainty"
              onClick={onExplain}
              title="How this uncertainty is calculated"
            >
              ±{similarity.uncertainty.total}
            </button>
            <span className="sim-band">
              {similarity.uncertainty.low}–{similarity.uncertainty.high}%
            </span>
          </>
        )}
      </div>
      <p className="dimension-basis">{verdict.basis}</p>
      {verdict.caveats.map((caveat) => (
        <p className="dimension-caveat" key={caveat}>
          {caveat}
        </p>
      ))}
    </div>
  );
}

/**
 * Everything a judge needs about one site, in one column: the three dimension
 * verdicts, the four physical limits no Earth site escapes, the measured ground,
 * the datasets behind the numbers, and an export that survives the demo.
 */
/**
 * The dossier's open control: a pair of diagonal arrows pointing out to the
 * corners, at a 2.6 px stroke so the shape survives the card's dark surface at
 * 20 px.
 */
function ExpandGlyph() {
  return (
    <svg
      className="dossier-expand-glyph"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {/* Head at the outer end: the arrows point out towards the corners. */}
      <path d="M13 5.5h5.5V11" />
      <path d="M12.9 11.1 18.5 5.5" />
      <path d="M11 18.5H5.5V13" />
      <path d="M11.1 12.9 5.5 18.5" />
    </svg>
  );
}

/**
 * Close, once the dossier is opened out.
 *
 * An X rather than the arrows turned inward: the panel is a sheet over the
 * workbench at that point, and a sheet is dismissed rather than collapsed. It
 * sits in the same box as the arrows, so the control does not move when the
 * state changes under the pointer, and it is the one control that also answers
 * the click on the backdrop.
 */
function CloseGlyph() {
  return (
    <svg
      className="dossier-expand-glyph"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

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
  /** The dimension whose ± is open in the budget dialog, if any. */
  const [explained, setExplained] = useState<DimensionSimilarity | null>(null);

  if (!prediction) {
    return (
      <div className="empty">
        <p>No site selected.</p>
        <p className="empty-sub">Pick a row from the ranked list or click a beacon on the globe.</p>
        {/* Still offered when there is nothing to show: an opened dossier that
            lost its selection must not trap the reader in an empty overlay. */}
        {expanded ? (
          <button
            type="button"
            className="dossier-expand"
            onClick={onToggleExpand}
            aria-label="Close the dossier"
            title="Close the dossier and go back to the workbench"
          >
            <CloseGlyph />
          </button>
        ) : null}
      </div>
    );
  }

  const classification = classifySite(prediction, target);
  const siteDatasets = datasetsFor(prediction, datasets);
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
            aria-label={expanded ? 'Close the dossier' : 'Expand the dossier'}
            onClick={onToggleExpand}
            title={
              expanded
                ? 'Close the dossier and go back to the workbench'
                : 'Open the dossier across the page to read it'
            }
          >
            {expanded ? <CloseGlyph /> : <ExpandGlyph />}
          </button>
        </span>
      </div>

      <h2 className="dossier-name">{prediction.siteName}</h2>
      <p className="dossier-meta">
        {prediction.region ?? '—'} · {terrainLabel(prediction)} ·{' '}
        {formatElevation(prediction.elevationM)}
      </p>

      {/* The coordinates identify the site as much as the name does, so they sit
          with the header rather than at the foot of the column beside the model
          id. Its own one-column facts grid: a screened cell's pair is long
          enough to clip against a second column. */}
      <dl className="facts facts-coords">
        <div>
          <dt>Coordinates</dt>
          <dd>{formatCoords(prediction.lat, prediction.lon)}</dd>
        </div>
      </dl>

      {/* The three verdicts, which are the whole classification, come straight
          after the coordinates: what the site is, then how it compares. The limits
          and measured ground that follow are the evidence for these three lines. */}
      <div className="dimensions">
        <div className="dimensions-head">
          <span className="kicker">Classified against {TARGET_LABELS[target]}</span>
          <span className="dimensions-count">
            {classification.agreements} of 3 similar
          </span>
        </div>
        <p className="dimensions-note">
          Each percentage belongs to its own dimension and is never averaged into a site score.
        </p>
        {/* All three verdicts, in the guide's order. A dimension that matched keeps
            the bright badge; the ones that did not keep their numbers and their basis
            text but lose the emphasis, so a site always shows what it shares with the
            target as well as where it departs — the analogue claim is not hidden
            behind a heading that only appears when something matches. */}
        {classification.dimensions.map((verdict) => {
          const similarity = similarityFor(verdict, target);
          return (
            <DimensionBlock
              key={verdict.id}
              verdict={verdict}
              similarity={similarity}
              onExplain={() => setExplained(similarity)}
              muted={verdict.state !== 'similar'}
            />
          );
        })}
      </div>

      <p className="verdict">{classificationSummary(classification)}</p>

      {/* The four limits, which apply to every site on the list. */}
      <h3 className="section-title">
        Physical limits <span className="section-count">All sites</span>
      </h3>
      <ul className="limits">
        {classification.limitations.map((limit) => (
          <li key={limit.id}>
            <span className="limit-name">{limit.label}</span>
            <span className="limit-pair">
              {limit.earth} → {limit.target}
            </span>
            <p className="limit-why">{limit.why}</p>
          </li>
        ))}
      </ul>

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
          Illumination is not part of this classification: a permanent south polar base
          depends on horizon-scale sunlight and direct Earth visibility, and this build
          models neither.
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
          <dt>Model</dt>
          <dd>
            {prediction.model.id} {prediction.model.version}
          </dd>
        </div>
        {/* Who found this ground: our own screening pass over the committed SRTM
            grids, or a person who catalogued the site from the literature. */}
        <div>
          <dt>Found by</dt>
          <dd>{foundByTerraNexus(prediction) ? 'TerraNexus screening pass' : 'Catalogued'}</dd>
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


      {explained ? (
        <UncertaintyDialog
          similarity={explained}
          target={target}
          onClose={() => setExplained(null)}
        />
      ) : null}
    </div>
  );
}
