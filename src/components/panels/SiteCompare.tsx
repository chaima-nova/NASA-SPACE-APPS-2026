import { useMemo, useState } from 'react';
import { Modal } from '../layout/Modal';
import { photoPageUrl, photoUrl, type SitePhoto } from '../../data/sitePhotos';
import {
  IMAGERY_WINDOW_DAYS,
  TRUE_COLOR_LAYER,
  imageryWindow,
  latestImageryDate,
  siteImagery,
} from '../../lib/earthImagery';
import { formatCoords, formatElevation, TERRAIN_LABELS } from '../../lib/site';
import type { TerrainType } from '../../data-contracts/types';

/** Anything with a position on Earth: a model site or a reported one. */
export interface CompareTarget {
  id: string;
  siteName: string;
  lat: number;
  lon: number;
  terrainType?: TerrainType;
  elevationM?: number;
}

interface SiteCompareProps {
  site: CompareTarget;
  /** Curated field photos, if any (reported sites may have none). */
  photos: SitePhoto[];
  /** Photo supplied by the reporter, used when there are no curated frames. */
  reportPhotoUrl?: string;
  onClose: () => void;
}

/** Ground span options, in kilometres of latitude. */
const SPANS: Array<{ label: string; degrees: number; size: number }> = [
  { label: '50 km', degrees: 0.45, size: 900 },
  { label: '15 km', degrees: 0.135, size: 900 },
  { label: '4 km', degrees: 0.036, size: 900 },
];

const WINDOW = imageryWindow();

const day = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
};

/**
 * Orbit versus ground: the real satellite pass over the site next to a real
 * photograph taken on it.
 *
 * The satellite side is NASA GIBS true colour, the same keyless service the
 * globe uses, requested for one site's bounding box on a chosen day. The field
 * side is the curated Commons photo, or the reporter's own picture for a
 * site that has no curated set. Both captions state exactly what the frame is,
 * because these two images do not show the same thing at the same scale.
 */
export function SiteCompare({ site, photos, reportPhotoUrl, onClose }: SiteCompareProps) {
  const [date, setDate] = useState(() => latestImageryDate());
  const [span, setSpan] = useState(SPANS[0]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [satState, setSatState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [groundState, setGroundState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const imagery = useMemo(
    () => siteImagery(site.lat, site.lon, span.degrees, span.size, date),
    [site.lat, site.lon, span, date],
  );

  const photo = photos[photoIndex];
  const groundUrl = photo ? photoUrl(photo, 1600) : reportPhotoUrl;

  return (
    <Modal
      kicker="Orbit vs ground"
      title={site.siteName}
      subtitle={
        <>
          {formatCoords(site.lat, site.lon)} ·{' '}
          {site.terrainType ? TERRAIN_LABELS[site.terrainType] : 'Unclassified terrain'} ·{' '}
          {formatElevation(site.elevationM)}
        </>
      }
      onClose={onClose}
      size="lg"
      className="compare-modal"
      footer={
        <>
          <span className="modal-foot-note">
            Satellite: NASA GIBS {TRUE_COLOR_LAYER} · {imagery.widthKm}×{imagery.heightKm} km ·
            bbox {imagery.bbox} · {day(date)} UTC. Field: representative ground photograph, not the
            same instant.
          </span>
        </>
      }
    >
      <div className="compare-controls">
        <div className="compare-control">
          <span className="facet-label">Imagery day</span>
          <label className="mini-field">
            <span className="sr-only">Satellite imagery date (UTC)</span>
            <input
              type="date"
              value={date}
              min={WINDOW.min}
              max={WINDOW.max}
              onChange={(event) => {
                const next = event.target.value;
                if (!next || next === date) return;
                setSatState('loading');
                setDate(next);
              }}
            />
          </label>
          <span className="compare-hint">last {IMAGERY_WINDOW_DAYS} days</span>
        </div>

        <div className="compare-control">
          <span className="facet-label">Ground span</span>
          <div className="segmented" role="group" aria-label="Ground span">
            {SPANS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={option.label === span.label}
                className="segmented-btn"
                onClick={() => {
                  if (option.label === span.label) return;
                  setSatState('loading');
                  setSpan(option);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="compare-grid">
        <figure className="compare-pane">
          <div className="compare-media">
            {satState === 'failed' ? (
              <div className="compare-missing">
                <p>NASA GIBS did not return an image for this day and box.</p>
                <a href={imagery.url} target="_blank" rel="noreferrer">
                  Open the WMS request
                </a>
              </div>
            ) : (
              <>
                {satState === 'loading' ? <span className="gallery-shimmer" aria-hidden="true" /> : null}
                <img
                  key={imagery.url}
                  src={imagery.url}
                  alt={`NASA satellite true-colour imagery around ${site.siteName}`}
                  onLoad={() => setSatState('ready')}
                  onError={() => setSatState('failed')}
                  className={satState === 'ready' ? 'is-loaded' : ''}
                  draggable={false}
                />
              </>
            )}
            <span className="compare-corner" aria-hidden="true">
              N
            </span>
          </div>
          <figcaption className="compare-caption">
            <span className="compare-caption-title">Orbit · NASA GIBS true colour</span>
            <span>
              {imagery.widthKm}×{imagery.heightKm} km around the site, {day(date)} UTC. VIIRS
              corrected reflectance, ~375 m per pixel — regional context, not site detail.
            </span>
          </figcaption>
        </figure>

        <figure className="compare-pane">
          <div className="compare-media">
            {groundUrl && groundState !== 'failed' ? (
              <>
                {groundState === 'loading' ? <span className="gallery-shimmer" aria-hidden="true" /> : null}
                <img
                  key={groundUrl}
                  src={groundUrl}
                  alt={photo ? photo.caption : `Ground photograph of ${site.siteName}`}
                  onLoad={() => setGroundState('ready')}
                  onError={() => setGroundState('failed')}
                  className={groundState === 'ready' ? 'is-loaded' : ''}
                  draggable={false}
                />
              </>
            ) : (
              <div className="compare-missing">
                <p>
                  {groundState === 'failed'
                    ? 'The ground photograph could not be loaded.'
                    : 'No ground photograph is catalogued for this site yet.'}
                </p>
                <p className="compare-missing-sub">
                  Reported sites carry whatever photo the reporter supplied.
                  {groundUrl ? (
                    <>
                      {' '}
                      <a href={groundUrl} target="_blank" rel="noreferrer">
                        Open the link
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
            )}
          </div>
          <figcaption className="compare-caption">
            <span className="compare-caption-title">Ground · field photograph</span>
            {photo ? (
              <span>
                {photo.caption} — {photo.credit} · {photo.license} ·{' '}
                <a href={photoPageUrl(photo)} target="_blank" rel="noreferrer">
                  source
                </a>
              </span>
            ) : (
              <span>Supplied with the researcher's report.</span>
            )}
          </figcaption>
        </figure>
      </div>

      {photos.length > 1 ? (
        <div className="compare-thumbs">
          {photos.map((entry, index) => (
            <button
              key={entry.file}
              type="button"
              className={index === photoIndex ? 'compare-thumb is-active' : 'compare-thumb'}
              aria-pressed={index === photoIndex}
              onClick={() => {
                if (index === photoIndex) return;
                setGroundState('loading');
                setPhotoIndex(index);
              }}
              title={entry.caption}
            >
              <img src={photoUrl(entry, 240)} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}
