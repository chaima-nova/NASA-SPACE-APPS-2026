import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../layout/Modal';
import { photoPageUrl, photoUrl, type SitePhoto } from '../../data/sitePhotos';
import {
  COMPOSITE_DAYS,
  IMAGERY_WINDOW_DAYS,
  TRUE_COLOR_LAYER,
  boxImageryUrl,
  compositeDates,
  imageryWindow,
  latestImageryDate,
  siteImagery,
} from '../../lib/earthImagery';
import { cloudFreeComposite } from '../../lib/cloudFree';
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

/** Single day, or the median of the last few days. */
type Source = 'day' | 'composite';

interface CompositeState {
  status: 'loading' | 'ready' | 'failed';
  /** Object URL of the composited frame, once it exists. */
  url?: string;
  /** How many days actually made it into the stack. */
  days?: number;
}

/**
 * True when a frame came back as one flat black rectangle.
 *
 * GIBS answers a box it has not processed yet with an empty image rather than an
 * error, so the newest day of a site can be a black square. The frames are read
 * with CORS, so the check is a 16 px poke at the picture already on screen — no
 * second request. A frame that cannot be read is assumed to be fine; the check
 * exists to explain a blank pane, not to police the service.
 */
function isBlankFrame(image: HTMLImageElement): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = 16;
    probe.height = 16;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0, 16, 16);
    const { data } = context.getImageData(0, 0, 16, 16);
    let brightest = 0;
    for (let i = 0; i < data.length; i += 4) {
      brightest = Math.max(brightest, data[i], data[i + 1], data[i + 2]);
    }
    return brightest < 6;
  } catch {
    return false;
  }
}

const day = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
};

/**
 * Satellite versus ground: the real satellite pass over the site next to a real
 * photograph taken on it.
 *
 * The satellite side is NASA GIBS true colour, the same keyless service the
 * globe uses, requested for one site's bounding box. The field side is the
 * curated Commons photo, or the reporter's own picture for a site that has no
 * curated set. Both captions state exactly what the frame is, because these two
 * images do not show the same thing at the same scale.
 *
 * The satellite half opens on a cloud-free composite: a single daily pass is
 * routinely hidden under cloud, and the mosaic's ~375 m resolution cannot be
 * improved by asking for more pixels, so stacking a few days is the one change
 * that reliably makes the pane readable. The stack is medianed in the browser
 * (see lib/cloudFree.ts) and the caption always names the days it covers; the
 * single-day pass is one click away for anyone who wants the pass itself.
 */
export function SiteCompare({ site, photos, reportPhotoUrl, onClose }: SiteCompareProps) {
  const [date, setDate] = useState(() => latestImageryDate());
  const [span, setSpan] = useState(SPANS[0]);
  const [source, setSource] = useState<Source>('composite');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [satState, setSatState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [groundState, setGroundState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [composite, setComposite] = useState<CompositeState>({ status: 'loading' });
  const [blankDay, setBlankDay] = useState(false);

  const imagery = useMemo(
    () => siteImagery(site.lat, site.lon, span.degrees, span.size, date),
    [site.lat, site.lon, span, date],
  );

  // The composite is built off-screen: `trueColorUrl`-style requests per day,
  // medianed pixel for pixel. A frame that fails is dropped from the stack, and
  // if nothing loads the pane falls back to the single pass rather than to an
  // empty box.
  const run = useRef(0);
  useEffect(() => {
    if (source !== 'composite') return;
    const ticket = ++run.current;
    const controller = new AbortController();
    setComposite({ status: 'loading' });

    const days = compositeDates(date);
    const urls = days.map((day) => boxImageryUrl(imagery.bbox, span.size, day));
    cloudFreeComposite(urls, span.size, controller.signal)
      .then((result) => {
        if (ticket !== run.current) {
          URL.revokeObjectURL(result.url);
          return;
        }
        setComposite({ status: 'ready', url: result.url, days: result.days });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || ticket !== run.current) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setComposite({ status: 'failed' });
      });

    return () => {
      controller.abort();
      run.current += 1;
    };
  }, [source, imagery.bbox, span.size, date]);

  // The composited frame is an object URL; keep it alive only while it is shown.
  useEffect(() => {
    const url = composite.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [composite.url]);

  const usingComposite = source === 'composite' && composite.status !== 'failed';
  const satUrl = usingComposite ? composite.url : imagery.url;
  const compositedDays = composite.status === 'ready' ? composite.days : null;
  const sourceNote = usingComposite
    ? `cloud-free median of ${compositedDays ?? COMPOSITE_DAYS} days to ${day(date)}`
    : `the ${day(date)} pass`;

  const photo = photos[photoIndex];
  const groundUrl = photo ? photoUrl(photo, 1600) : reportPhotoUrl;
  const satLoading = usingComposite ? composite.status !== 'ready' : satState === 'loading';

  return (
    <Modal
      kicker="Satellite ↔ Ground Comparison"
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
            bbox {imagery.bbox} · {sourceNote}. Field: representative ground photograph, not the
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
                setBlankDay(false);
                setDate(next);
              }}
            />
          </label>
          <span className="compare-hint">last {IMAGERY_WINDOW_DAYS} days</span>
        </div>

        <div className="compare-control">
          <span className="facet-label">Satellite frame</span>
          <div className="segmented" role="group" aria-label="Satellite frame">
            <button
              type="button"
              aria-pressed={source === 'composite'}
              className="segmented-btn"
              title={`Median of the ${COMPOSITE_DAYS} days ending ${day(date)} — cloud drops out`}
              onClick={() => {
                if (source === 'composite') return;
                setSatState('loading');
                setBlankDay(false);
                setSource('composite');
              }}
            >
              Cloud-free
            </button>
            <button
              type="button"
              aria-pressed={source === 'day'}
              className="segmented-btn"
              title={`The single ${day(date)} UTC pass`}
              onClick={() => {
                if (source === 'day') return;
                setSatState('loading');
                setBlankDay(false);
                setSource('day');
              }}
            >
              Single day
            </button>
          </div>
          <span className="compare-hint">
            {source === 'composite' ? `median of ${COMPOSITE_DAYS} days` : 'one pass'}
          </span>
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
                  setBlankDay(false);
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
            {satState === 'failed' || blankDay ? (
              <div className="compare-missing">
                {satState === 'failed' ? (
                  <p>NASA GIBS did not return an image for this day and box.</p>
                ) : (
                  <>
                    <p>NASA GIBS has no processed imagery for this day and box yet.</p>
                    <p className="compare-missing-sub">
                      Try an earlier day, or switch back to the cloud-free frame, which is built
                      from the last {COMPOSITE_DAYS} days.
                    </p>
                  </>
                )}
                <a href={imagery.url} target="_blank" rel="noreferrer">
                  Open the WMS request
                </a>
              </div>
            ) : (
              <>
                {satLoading ? <span className="gallery-shimmer" aria-hidden="true" /> : null}
                {satUrl ? (
                  <img
                    key={satUrl}
                    src={satUrl}
                    // Only the plain GIBS frame is read back, to spot an
                    // unprocessed day; a composited frame needs no CORS.
                    crossOrigin={usingComposite ? undefined : 'anonymous'}
                    alt={`NASA satellite true-colour imagery around ${site.siteName}`}
                    onLoad={(event) => {
                      setSatState('ready');
                      setBlankDay(!usingComposite && isBlankFrame(event.currentTarget));
                    }}
                    onError={() => setSatState('failed')}
                    className={satState === 'ready' && !blankDay ? 'is-loaded' : ''}
                    draggable={false}
                  />
                ) : null}
              </>
            )}
            <span className="compare-corner" aria-hidden="true">
              N
            </span>
          </div>
          <figcaption className="compare-caption">
            <span className="compare-caption-title">
              {usingComposite
                ? 'Satellite · NASA GIBS true colour · cloud-free composite'
                : 'Satellite · NASA GIBS true colour'}
            </span>
            <span>
              {imagery.widthKm}×{imagery.heightKm} km around the site,{' '}
              {usingComposite
                ? `${compositedDays ?? COMPOSITE_DAYS} passes ending ${day(date)} UTC, medianed per pixel`
                : `${day(date)} UTC pass`}
              . VIIRS corrected reflectance, ~375 m per pixel — regional context, not site detail.
            </span>
            {source === 'composite' && composite.status === 'failed' ? (
              <span className="compare-note">
                The cloud-free stack could not be built for this box, so the single day is shown.
              </span>
            ) : null}
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
