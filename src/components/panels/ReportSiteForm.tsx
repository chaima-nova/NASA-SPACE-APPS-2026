import { useMemo, useState } from 'react';
import type { FocusArea, ReportedSite, TerrainType } from '../../data-contracts/types';
import { Modal } from '../layout/Modal';
import { createReportedSite, type ReportInput } from '../../lib/community';
import { TERRAIN_LABELS, TERRAIN_ORDER } from '../../lib/site';

interface ReportSiteFormProps {
  /** Present when editing an existing report; absent when creating one. */
  initial?: ReportedSite;
  onSave: (site: ReportedSite) => void;
  onClose: () => void;
}

const FOCUS_OPTIONS: Array<{ value: FocusArea; label: string }> = [
  { value: 'dual-analog', label: 'Both worlds' },
  { value: 'moon-base-analog', label: 'Moon base' },
  { value: 'mars-base-analog', label: 'Mars base' },
];

const emptyFields = {
  name: '',
  lat: '',
  lon: '',
  region: '',
  terrainType: '',
  focusArea: 'dual-analog' as FocusArea,
  elevationM: '',
  reporter: '',
  evidence: '',
  photoUrl: '',
};

type Fields = typeof emptyFields;

function fieldsFrom(site: ReportedSite | undefined): Fields {
  if (!site) return { ...emptyFields };
  return {
    name: site.name,
    lat: String(site.lat),
    lon: String(site.lon),
    region: site.region ?? '',
    terrainType: site.terrainType ?? '',
    focusArea: site.focusArea,
    elevationM: site.elevationM === undefined ? '' : String(site.elevationM),
    reporter: site.reporter,
    evidence: site.evidence,
    photoUrl: site.photoUrl ?? '',
  };
}

/** A valid http(s) URL, or empty (the field is optional). */
function urlProblem(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : 'Must be an http(s) link';
  } catch {
    return 'Must be a full link, e.g. https://…';
  }
}

/**
 * Validates the report and returns per-field messages. Kept out of the
 * component so the same rules can be asserted without a renderer.
 */
export function validateReport(fields: {
  name: string;
  lat: string;
  lon: string;
  terrainType: string;
  reporter: string;
  evidence: string;
  photoUrl: string;
  elevationM: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (fields.name.trim().length < 3) errors.name = 'Give the site a name of at least 3 characters.';

  const lat = Number(fields.lat);
  if (fields.lat.trim() === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.lat = 'Latitude must be a number between -90 and 90.';
  }
  const lon = Number(fields.lon);
  if (fields.lon.trim() === '' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    errors.lon = 'Longitude must be a number between -180 and 180.';
  }

  if (!TERRAIN_ORDER.includes(fields.terrainType as TerrainType)) {
    errors.terrainType = 'Pick the terrain family this site belongs to.';
  }

  if (fields.reporter.trim().length < 2) errors.reporter = 'Name the person making the report.';

  if (fields.evidence.trim().length < 20) {
    errors.evidence = 'Describe the field evidence in at least 20 characters.';
  }

  if (fields.elevationM.trim() !== '') {
    const elevation = Number(fields.elevationM);
    if (!Number.isFinite(elevation) || elevation < -500 || elevation > 9000) {
      errors.elevationM = 'Elevation must be between -500 and 9000 m.';
    }
  }

  const photoProblem = urlProblem(fields.photoUrl.trim());
  if (photoProblem) errors.photoUrl = photoProblem;

  return errors;
}

/**
 * "Report an analog site" — the researcher's entry point.
 *
 * The submitted site is explicitly *not* a prediction: it has no analog-fit
 * score, it is listed apart from the ranked queue, and the copy says so. The
 * form therefore insists on the evidence note, which is the thing that makes a
 * report worth reviewing.
 */
export function ReportSiteForm({ initial, onSave, onClose }: ReportSiteFormProps) {
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(initial));
  const [attempted, setAttempted] = useState(false);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const liveErrors = useMemo(() => validateReport(fields), [fields]);
  const shown = attempted ? liveErrors : {};
  const valid = Object.keys(liveErrors).length === 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!valid) {
      // Move the caret to the first problem instead of only colouring it.
      document
        .querySelector<HTMLElement>(
          '.report-form .is-invalid input, .report-form .is-invalid select, .report-form .is-invalid textarea',
        )
        ?.focus();
      return;
    }

    const input: ReportInput = {
      name: fields.name,
      lat: Number(fields.lat),
      lon: Number(fields.lon),
      region: fields.region || undefined,
      terrainType: fields.terrainType as TerrainType,
      focusArea: fields.focusArea,
      elevationM: fields.elevationM === '' ? undefined : Number(fields.elevationM),
      evidence: fields.evidence,
      photoUrl: fields.photoUrl || undefined,
      reporter: fields.reporter,
    };

    const site = createReportedSite(input);
    // Editing keeps the original id, submitter and timestamp.
    onSave(
      initial
        ? { ...site, id: initial.id, submittedAt: initial.submittedAt, source: initial.source }
        : site,
    );
  }

  const field = (
    key: keyof Fields,
    label: string,
    hint: string,
    options: {
      type?: string;
      step?: string;
      placeholder?: string;
      rows?: number;
    } = {},
  ) => {
    const message = shown[key];
    const id = `report-${key}`;
    return (
      <label className={`report-field${message ? ' is-invalid' : ''}`} htmlFor={id}>
        <span className="report-label">
          {label}
          <span className="report-hint">{hint}</span>
        </span>
        {options.rows ? (
          <textarea
            id={id}
            className="report-input"
            rows={options.rows}
            value={fields[key]}
            placeholder={options.placeholder}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? `${id}-error` : undefined}
            onChange={(event) => set(key, event.target.value as Fields[typeof key])}
          />
        ) : (
          <input
            id={id}
            className="report-input"
            type={options.type ?? 'text'}
            step={options.step}
            value={fields[key]}
            placeholder={options.placeholder}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? `${id}-error` : undefined}
            onChange={(event) => set(key, event.target.value as Fields[typeof key])}
          />
        )}
        {message ? (
          <span className="report-error" id={`${id}-error`} role="alert">
            {message}
          </span>
        ) : null}
      </label>
    );
  };

  return (
    <Modal
      kicker={initial ? 'Edit report' : 'Researcher report'}
      title={initial ? `Edit ${initial.name}` : 'Report a new analog site'}
      subtitle="Add a candidate site with the field evidence behind it. Reports are stored unscored — no analog-fit number is invented for them."
      onClose={onClose}
      size="md"
      className="report-modal"
      footer={
        <>
          <span className="modal-foot-note">
            {valid
              ? 'Stored in this browser; synced to the shared backend when one is configured.'
              : 'Fill the highlighted fields to continue.'}
          </span>
          <div className="modal-foot-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" form="report-site-form" className="btn btn-primary">
              {initial ? 'Save changes' : 'Add reported site'}
            </button>
          </div>
        </>
      }
    >
      <form id="report-site-form" className="report-form" onSubmit={submit} noValidate>
        <div className="report-grid">
          {field('name', 'Site name', 'e.g. “Onyx Valley, Antarctica”', {
            placeholder: 'Named locality, not a mission name',
          })}
          {field('region', 'Region', 'optional', { placeholder: 'Country · province · basin' })}
          {field('lat', 'Latitude', 'decimal degrees, -90 to 90', {
            type: 'number',
            step: 'any',
            placeholder: '-77.5',
          })}
          {field('lon', 'Longitude', 'decimal degrees, -180 to 180', {
            type: 'number',
            step: 'any',
            placeholder: '161.5',
          })}
        </div>

        <div className="report-grid">
          <label className={`report-field${shown.terrainType ? ' is-invalid' : ''}`} htmlFor="report-terrainType">
            <span className="report-label">
              Terrain family
              <span className="report-hint">drives the palette and filters</span>
            </span>
            <select
              id="report-terrainType"
              className="report-input"
              value={fields.terrainType}
              aria-invalid={shown.terrainType ? true : undefined}
              aria-describedby={shown.terrainType ? 'report-terrainType-error' : undefined}
              onChange={(event) => set('terrainType', event.target.value)}
            >
              <option value="">Choose…</option>
              {TERRAIN_ORDER.map((type) => (
                <option key={type} value={type}>
                  {TERRAIN_LABELS[type]}
                </option>
              ))}
            </select>
            {shown.terrainType ? (
              <span className="report-error" id="report-terrainType-error" role="alert">
                {shown.terrainType}
              </span>
            ) : null}
          </label>

          <label className="report-field" htmlFor="report-focusArea">
            <span className="report-label">
              Proposed analog for
              <span className="report-hint">which world this site stands in for</span>
            </span>
            <select
              id="report-focusArea"
              className="report-input"
              value={fields.focusArea}
              onChange={(event) => set('focusArea', event.target.value as FocusArea)}
            >
              {FOCUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="report-grid">
          {field('elevationM', 'Mean elevation', 'metres, optional', {
            type: 'number',
            step: 'any',
            placeholder: '1200',
          })}
          {field('reporter', 'Reported by', 'your name or team', { placeholder: 'Team / initials' })}
        </div>

        {field('evidence', 'Field evidence', 'what was observed, sampled or measured', {
          rows: 4,
          placeholder:
            'Basaltic rubble with aeolian ripples; 3 cm of loose regolith over intact flow; no standing water in the last 40 years of record…',
        })}

        {field('photoUrl', 'Ground photo link', 'optional · https link to an image', {
          placeholder: 'https://…',
        })}

        <p className="report-note">
          Coordinates place the site on the globe and drive the terrain fly-in. Reports stay labelled
          unreviewed until someone runs them through the model.
        </p>
      </form>
    </Modal>
  );
}
