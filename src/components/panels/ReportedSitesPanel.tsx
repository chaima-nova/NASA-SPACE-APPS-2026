import type { ReportedSite } from '../../data-contracts/types';
import { Modal } from '../layout/Modal';
import { reportsCsv, reportsJson } from '../../lib/community';
import { downloadFile } from '../../lib/download';
import { formatCoords, formatElevation, TERRAIN_LABELS } from '../../lib/site';

interface ReportedSitesPanelProps {
  sites: ReportedSite[];
  /** True when a backend is configured but the last write did not reach it. */
  syncFailed: boolean;
  onNew: () => void;
  onEdit: (site: ReportedSite) => void;
  onDelete: (site: ReportedSite) => void;
  onClose: () => void;
}

const stamp = () => new Date().toISOString().slice(0, 10);

function submitted(site: ReportedSite): string {
  const date = new Date(site.submittedAt);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 10);
}

/**
 * Everything this browser has reported, in one place: review a report, fix a
 * coordinate, delete a duplicate, or take the whole set away as JSON/CSV for
 * the model pipeline.
 */
export function ReportedSitesPanel({
  sites,
  syncFailed,
  onNew,
  onEdit,
  onDelete,
  onClose,
}: ReportedSitesPanelProps) {
  return (
    <Modal
      kicker="Researcher reports"
      title={`Reported candidates (${sites.length})`}
      subtitle="Unscored sites added from the field. They sit outside the model ranking until the pipeline scores them."
      onClose={onClose}
      size="lg"
      className="reports-modal"
      footer={
        <>
          <span className="modal-foot-note">
            {syncFailed
              ? 'Saved in this browser — the shared backend did not accept the last change.'
              : 'Saved in this browser; synced to the shared backend when one is configured.'}
          </span>
          <div className="modal-foot-actions">
            <button
              type="button"
              className="btn"
              disabled={sites.length === 0}
              onClick={() => downloadFile(`reported-sites-${stamp()}.json`, reportsJson(sites), 'application/json')}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn"
              disabled={sites.length === 0}
              onClick={() => downloadFile(`reported-sites-${stamp()}.csv`, reportsCsv(sites), 'text/csv')}
            >
              Export CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={onNew}>
              Report a site
            </button>
          </div>
        </>
      }
    >
      {sites.length === 0 ? (
        <div className="empty">
          <p>No sites reported yet.</p>
          <p className="empty-sub">
            Use “Report a site” to add one: name, coordinates, terrain family and the field evidence
            behind it.
          </p>
        </div>
      ) : (
        <ul className="report-list">
          {sites.map((site) => (
            <li key={site.id} className="report-row">
              <div className="report-row-main">
                <div className="report-row-head">
                  <h3>{site.name}</h3>
                  <span className="pill pill-report">Unreviewed</span>
                </div>
                <p className="report-row-meta">
                  {site.region ? `${site.region} · ` : ''}
                  {formatCoords(site.lat, site.lon)} ·{' '}
                  {site.terrainType ? TERRAIN_LABELS[site.terrainType] : 'Unclassified'} ·{' '}
                  {formatElevation(site.elevationM)}
                </p>
                <p className="report-row-evidence">{site.evidence}</p>
                <p className="report-row-foot">
                  {site.reporter} · submitted {submitted(site)} · for{' '}
                  {site.targets.map((t) => (t === 'moon' ? 'Moon' : 'Mars')).join(' + ')}
                  {site.photoUrl ? (
                    <>
                      {' · '}
                      <a href={site.photoUrl} target="_blank" rel="noreferrer">
                        ground photo
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="report-row-actions">
                <button type="button" className="btn btn-small" onClick={() => onEdit(site)}>
                  Edit
                </button>
                <button type="button" className="btn btn-small btn-danger" onClick={() => onDelete(site)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
