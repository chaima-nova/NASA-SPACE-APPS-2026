import type { CommunityState, ReportedSite } from '../../data-contracts/types';
import { SiteCommunity, type CommunityActions } from './SiteCommunity';
import { formatCoords, formatElevation, TERRAIN_LABELS } from '../../lib/site';

interface ReportedDossierProps {
  site: ReportedSite;
  community: CommunityState;
  /** Community writes already bound to this site. */
  actions: CommunityActions;
  onFlyIn: (site: ReportedSite) => void;
  onCompare: (site: ReportedSite) => void;
  onEdit: (site: ReportedSite) => void;
  onDelete: (site: ReportedSite) => void;
}

const shortDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 10);
};

/**
 * Dossier for a site nobody has scored yet.
 *
 * The ranked dossier's job is to justify a number; this one's job is to hand a
 * reviewer everything needed to *produce* one — where it is, what was seen, who
 * saw it — without showing a score that does not exist.
 */
export function ReportedDossier({
  site,
  community,
  actions,
  onFlyIn,
  onCompare,
  onEdit,
  onDelete,
}: ReportedDossierProps) {
  return (
    <div className="dossier dossier-reported">
      <div className="dossier-top">
        <span className="kicker">Reported site</span>
        <span className="pill pill-report">Unreviewed</span>
      </div>

      <h2 className="dossier-name">{site.name}</h2>
      <p className="dossier-meta">
        {site.region ? `${site.region} · ` : ''}
        {site.terrainType ? TERRAIN_LABELS[site.terrainType] : 'Unclassified terrain'} ·{' '}
        {formatElevation(site.elevationM)}
      </p>

      <div className="report-unscored">
        <span className="report-unscored-mark" aria-hidden="true">
          –
        </span>
        <div>
          <strong>No analog-fit score yet</strong>
          <p>
            Reported by {site.reporter} on {shortDate(site.submittedAt)}. Until the feature vector is
            extracted and run through the model, this site is listed outside the ranking.
          </p>
        </div>
      </div>

      <div className="chips chips-wrap">
        {site.targets.map((target) => (
          <span key={target} className={`chip chip-static chip-${target}`}>
            {target === 'moon' ? 'Moon analog' : 'Mars analog'}
          </span>
        ))}
      </div>

      <div className="divider" />

      <h3 className="section-title">Field evidence</h3>
      <p className="verdict">{site.evidence}</p>
      {site.photoUrl ? (
        <p className="report-photo">
          <a href={site.photoUrl} target="_blank" rel="noreferrer">
            Ground photo supplied with the report
          </a>
        </p>
      ) : null}

      <div className="dossier-actions">
        <button type="button" className="btn btn-primary" onClick={() => onFlyIn(site)}>
          Fly in to terrain
        </button>
        <button type="button" className="btn compare-open" onClick={() => onCompare(site)}>
          Satellite <span className="compare-arrow">↔</span> Ground Comparison
        </button>
      </div>

      <dl className="facts">
        <div>
          <dt>Coordinates</dt>
          <dd>{formatCoords(site.lat, site.lon)}</dd>
        </div>
        <div>
          <dt>Reported by</dt>
          <dd>{site.reporter}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{shortDate(site.submittedAt)}</dd>
        </div>
      </dl>

      <SiteCommunity
        siteId={site.id}
        siteName={site.name}
        community={community}
        onVote={() => actions.onVote()}
        onAddNote={actions.onAddNote}
        onAddReview={actions.onAddReview}
        onDelete={actions.onDelete}
      />

      <div className="divider" />

      <div className="dossier-actions">
        <button type="button" className="btn" onClick={() => onEdit(site)}>
          Edit report
        </button>
        <button type="button" className="btn btn-danger" onClick={() => onDelete(site)}>
          Delete report
        </button>
      </div>
    </div>
  );
}
