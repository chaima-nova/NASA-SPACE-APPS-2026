import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../layout/Modal';
import { photoPageUrl, photoUrl, type SitePhoto } from '../../data/sitePhotos';
import {
  COMPOSITE_DAYS,
  IMAGERY_WINDOW_DAYS,
  RELIEF_LAYER,
  TRUE_COLOR_LAYER,
  boxImageryUrl,
  compositeDates,
  imageryWindow,
  latestImageryDate,
  reliefMapUrl,
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

/** One frame is one square WMS image, whichever span it covers. */
const FRAME = SPANS[0].size;

/** Closest the view goes: below this the mosaic has no more detail to give. */
const MIN_SPAN = 0.006;

/** Furthest out: a region-scale frame, still a box the service will serve. */
const MAX_SPAN = 4.5;

/** The ground on view, in degrees. Longitude wraps, latitude is clamped. */
interface View {
  lat: number;
  lon: number;
  span: number;
}

const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** East-west extent of a box span degrees tall at lat, as the WMS draws it. */
const widthAt = (span: number, lat: number) =>
  Math.min(360, span / Math.max(0.05, Math.cos((lat * Math.PI) / 180)));

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
 * Terrain versus satellite: a shaded-relief map of the site's box beside the
 * real satellite pass over the same ground.
 *
 * Both panes cover one bounding box at one span, so they are directly
 * comparable. The relief pane is a static global composite — ASTER GDEM, from
 * the same keyless GIBS endpoint — and shows slope and ridge structure with no
 * weather in the way; the satellite pane shows what that ground looked like on a
 * given day. Neither is site detail, because the box is tens of kilometres wide,
 * so every caption states its scale, its source and, for a pass, its date.
 *
 * The satellite half opens on a cloud-free composite: a single daily pass is
 * routinely hidden under cloud, and the mosaic's ~375 m resolution cannot be
 * improved by asking for more pixels, so stacking a few days is the one change
 * that reliably makes the pane readable. The stack is medianed in the browser
 * (see lib/cloudFree.ts) and the caption always names the days it covers.
 */
export function SiteCompare({ site, photos, reportPhotoUrl, onClose }: SiteCompareProps) {
  const [date, setDate] = useState(() => latestImageryDate());
  /**
   * The ground on view, not the site: dragging moves it and the wheel narrows
   * it, so the two panes behave like the map they are about.
   */
  const [view, setView] = useState<View>({ lat: site.lat, lon: site.lon, span: SPANS[0].degrees });
  /** The same ground once the gesture stops, which is when it is refetched. */
  const [settled, setSettled] = useState<View>({ lat: site.lat, lon: site.lon, span: SPANS[0].degrees });
  /** Pixel offset of a drag in progress, so the picture follows the pointer. */
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [source, setSource] = useState<Source>('composite');
  const [satState, setSatState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [composite, setComposite] = useState<CompositeState>({ status: 'loading' });
  const [blankDay, setBlankDay] = useState(false);

  // A gesture moves the view on every pointer move; the imagery is fetched
  // once it stops, so a drag across the map is one request, not forty.
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(view), 220);
    return () => window.clearTimeout(timer);
  }, [view]);

  const imagery = useMemo(
    () => siteImagery(settled.lat, settled.lon, settled.span, FRAME, date),
    [settled, date],
  );

  /** Zoom about a point of the frame, keeping the ground under the pointer. */
  const zoomAt = (factor: number, fx = 0.5, fy = 0.5) => {
    setView((current) => {
      const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, current.span * factor));
      if (span === current.span) return current;
      const groundLon = current.lon + (fx - 0.5) * widthAt(current.span, current.lat);
      const groundLat = current.lat + (0.5 - fy) * current.span;
      return {
        span,
        lon: wrapLon(groundLon - (fx - 0.5) * widthAt(span, current.lat)),
        lat: Math.max(-85, Math.min(85, groundLat - (0.5 - fy) * span)),
      };
    });
  };

  // One element per pane; both carry the same handlers over the same view.
  const panes = useRef<Array<HTMLDivElement | null>>([]);

  // Caught natively: a React wheel handler is passive and cannot stop the page
  // scrolling underneath while the pointer is over a pane.
  useEffect(() => {
    const nodes = panes.current.filter((node): node is HTMLDivElement => Boolean(node));
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
      zoomAt(
        Math.exp(event.deltaY * 0.0012),
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      );
    };
    nodes.forEach((node) => node.addEventListener("wheel", onWheel, { passive: false }));
    return () => nodes.forEach((node) => node.removeEventListener("wheel", onWheel));
    // The panes keep their identity for the life of the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Where a drag started: pointer id, its origin, and the frame it is on. */
  const gesture = useRef<{ id: number; x: number; y: number; width: number; height: number } | null>(null);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    setDrag({ dx: event.clientX - start.x, dy: event.clientY - start.y });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!dx && !dy) return;
    // Pixels to degrees: crossing part of the frame moves the centre by that
    // same part of the box, so the ground stays under the pointer.
    setView((current) => ({
      ...current,
      lon: wrapLon(current.lon - (dx / start.width) * widthAt(current.span, current.lat)),
      lat: Math.max(-85, Math.min(85, current.lat + (dy / start.height) * current.span)),
    }));
  };

  const dragStyle = drag
    ? { transform: "translate(" + drag.dx + "px, " + drag.dy + "px)" }
    : undefined;

  /** Where the site sits inside the current view, as frame percentages. */
  const siteLeft = 50 + ((site.lon - settled.lon) / imagery.widthDeg) * 100;
  const siteTop = 50 - ((site.lat - settled.lat) / imagery.heightDeg) * 100;
  const siteInFrame = siteLeft > -3 && siteLeft < 103 && siteTop > -3 && siteTop < 103;

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
    const urls = days.map((day) => boxImageryUrl(imagery.bbox, FRAME, day));
    cloudFreeComposite(urls, FRAME, controller.signal)
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
  }, [source, imagery.bbox, FRAME, date]);

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

  const relief = reliefMapUrl(imagery.bbox, FRAME);
  const satLoading = usingComposite ? composite.status !== 'ready' : satState === 'loading';

  return (
    <Modal
      kicker="Terrain ↔ Satellite Comparison"
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
            Terrain: NASA GIBS {RELIEF_LAYER} shaded relief, a static composite. Satellite: NASA
            GIBS {TRUE_COLOR_LAYER} · {imagery.widthKm}×{imagery.heightKm} km · bbox {imagery.bbox}{' '}
            · {sourceNote}.
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
                aria-pressed={Math.abs(view.span - option.degrees) < 1e-9}
                className="segmented-btn"
                onClick={() => {
                  if (Math.abs(view.span - option.degrees) < 1e-9) return;
                  setSatState('loading');
                  setBlankDay(false);
                  setView((current) => ({ ...current, span: option.degrees }));
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="compare-control">
          <span className="facet-label">Move the frame</span>
          <div className="compare-zoom" role="group" aria-label="Map view">
            <button type="button" className="segmented-btn" aria-label="Zoom in" onClick={() => zoomAt(1 / 1.7)}>
              +
            </button>
            <button type="button" className="segmented-btn" aria-label="Zoom out" onClick={() => zoomAt(1.7)}>
              &#8722;
            </button>
            <button
              type="button"
              className="segmented-btn"
              onClick={() => setView({ lat: site.lat, lon: site.lon, span: SPANS[0].degrees })}
            >
              Reset
            </button>
          </div>
          <span className="compare-hint">drag to pan · wheel to zoom</span>
        </div>
      </div>

      <div className="compare-grid">
        <figure className="compare-pane">
          <div
            className={drag ? "compare-media is-dragging" : "compare-media"}
            ref={(node) => {
              panes.current[0] = node;
            }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
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
                    style={dragStyle}
                  />
                ) : null}
              </>
            )}
            <span className="compare-tag" aria-hidden="true">
              b
            </span>
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
          <div
            className={drag ? "compare-media is-dragging" : "compare-media"}
            ref={(node) => {
              panes.current[1] = node;
            }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {mapState === 'failed' ? (
              <div className="compare-missing">
                <p>NASA GIBS did not return a relief map for this box.</p>
                <a href={relief} target="_blank" rel="noreferrer">
                  Open the WMS request
                </a>
              </div>
            ) : (
              <>
                {mapState === 'loading' ? (
                  <span className="gallery-shimmer" aria-hidden="true" />
                ) : null}
                <img
                  key={relief}
                  src={relief}
                  alt={'Shaded relief map of the ground around ' + site.siteName}
                  onLoad={() => setMapState('ready')}
                  onError={() => setMapState('failed')}
                  className={mapState === 'ready' ? 'is-loaded' : ''}
                  draggable={false}
                  style={dragStyle}
                />
              </>
            )}
            <span className="compare-tag" aria-hidden="true">
              a
            </span>
            {siteInFrame ? (
              <span
                className="compare-crosshair"
                aria-hidden="true"
                style={{ left: siteLeft + "%", top: siteTop + "%" }}
              />
            ) : null}
            <span className="compare-scale" aria-hidden="true">
              <span className="compare-scale-bar" />
              {Math.round(imagery.widthKm * 0.22).toLocaleString('en-US')} km
            </span>
          </div>
          <figcaption className="compare-caption">
            <span className="compare-caption-title">Terrain · NASA ASTER GDEM shaded relief</span>
            <span>
              The same {imagery.widthKm}×{imagery.heightKm} km box as the satellite pane, drawn from
              a global elevation composite rather than a daily pass, so ridge and slope structure
              stay visible where cloud would hide them. The crosshair is the site coordinate; the
              bar is 22% of the frame width.
            </span>
            <span>
              {site.terrainType ? TERRAIN_LABELS[site.terrainType] : 'Unclassified terrain'} ·{' '}
              {formatElevation(site.elevationM)} · {formatCoords(site.lat, site.lon)}
            </span>
          </figcaption>
        </figure>
      </div>

      {photos.length > 0 ? (
        <div className="compare-thumbs" aria-label="Field photographs of this site">
          <span className="compare-thumbs-label">Field photos</span>
          {photos.map((entry) => (
            <a
              key={entry.file}
              className="compare-thumb"
              href={photoPageUrl(entry)}
              target="_blank"
              rel="noreferrer"
              title={entry.caption}
            >
              <img src={photoUrl(entry, 240)} alt={entry.caption} loading="lazy" draggable={false} />
            </a>
          ))}
        </div>
      ) : reportPhotoUrl ? (
        <p className="compare-fields">
          Field evidence from the reporter:{' '}
          <a href={reportPhotoUrl} target="_blank" rel="noreferrer">
            open the supplied photograph
          </a>
          .
        </p>
      ) : null}
    </Modal>
  );
}
