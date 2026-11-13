import { useEffect, useMemo, useRef, useState } from 'react';
import type { Prediction } from '../../data-contracts/types';
import { photosFor, photoPageUrl, photoUrl } from '../../data/sitePhotos';
import { formatCoords, terrainLabel } from '../../lib/site';

interface SiteGalleryProps {
  prediction: Prediction;
  onClose: () => void;
}

/**
 * "See Site" field-photo gallery.
 *
 * A modal carousel over the same dark surface as the rest of the app: one
 * large frame, a thumbnail rail, arrow-key/Home/End navigation, and the
 * photographer + licence on every image. The backdrop is dismissible and focus
 * returns to whatever opened the dialog.
 */
export function SiteGallery({ prediction, onClose }: SiteGalleryProps) {
  const photos = useMemo(() => photosFor(prediction), [prediction]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const count = photos.length;
  const current = photos[index];

  // Reset the frame state whenever the visible photo changes.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [index]);

  // Escape closes; arrows move; Home/End jump.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (count < 2) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((i) => (i + 1) % count);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((i) => (i - 1 + count) % count);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setIndex(count - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onClose]);

  // Lock the page and keep keyboard focus inside the dialog.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);

    return () => {
      document.removeEventListener('keydown', onTab);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // Warm the neighbours so arrow-key browsing never waits on the network.
  useEffect(() => {
    if (count < 2) return;
    for (const offset of [1, -1]) {
      const photo = photos[(index + offset + count) % count];
      const image = new Image();
      image.src = photoUrl(photo, 1400);
    }
  }, [count, index, photos]);

  const step = (delta: number) => {
    if (count < 2) return;
    setIndex((i) => (i + delta + count) % count);
  };

  return (
    <div
      className="gallery-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-title"
      >
        <header className="gallery-head">
          <div>
            <span className="kicker">Field photography</span>
            <h2 id="gallery-title">{prediction.siteName}</h2>
            <p>
              {formatCoords(prediction.lat, prediction.lon)} · {terrainLabel(prediction)} ·{' '}
              {count} {count === 1 ? 'photo' : 'photos'}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="gallery-close"
            onClick={onClose}
            aria-label="Close photo gallery"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {current ? (
          <>
            <div className="gallery-stage">
              {count > 1 ? (
                <button
                  type="button"
                  className="gallery-arrow is-prev"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
              ) : null}

              <figure className="gallery-figure">
                <div className="gallery-media">
                  {!loaded && !failed ? <span className="gallery-shimmer" aria-hidden="true" /> : null}
                  {failed ? (
                    <div className="gallery-missing">
                      <p>This photo could not be loaded.</p>
                      <a href={photoPageUrl(current)} target="_blank" rel="noreferrer">
                        Open it on Wikimedia Commons
                      </a>
                    </div>
                  ) : (
                    <img
                      key={current.file}
                      src={photoUrl(current, 1600)}
                      alt={current.caption}
                      onLoad={() => setLoaded(true)}
                      onError={() => setFailed(true)}
                      className={loaded ? 'is-loaded' : ''}
                      draggable={false}
                    />
                  )}
                </div>
                <figcaption className="gallery-caption">
                  <span className="gallery-caption-title">{current.caption}</span>
                  <span className="gallery-caption-meta">
                    {current.credit} · {current.license} ·{' '}
                    <a href={photoPageUrl(current)} target="_blank" rel="noreferrer">
                      Wikimedia Commons
                    </a>
                  </span>
                </figcaption>
              </figure>

              {count > 1 ? (
                <button
                  type="button"
                  className="gallery-arrow is-next"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : null}
            </div>

            {count > 1 ? (
              <div className="gallery-thumbs" role="tablist" aria-label="Site photos">
                {photos.map((photo, photoIndex) => (
                  <button
                    key={photo.file}
                    type="button"
                    role="tab"
                    aria-selected={photoIndex === index}
                    aria-label={`Photo ${photoIndex + 1}: ${photo.caption}`}
                    className={photoIndex === index ? 'gallery-thumb is-active' : 'gallery-thumb'}
                    onClick={() => setIndex(photoIndex)}
                  >
                    <img src={photoUrl(photo, 320)} alt="" loading="lazy" draggable={false} />
                    <span>{String(photoIndex + 1).padStart(2, '0')}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <footer className="gallery-foot">
              <span className="gallery-count">
                {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </span>
              <span>
                Field references from Wikimedia Commons — near the site, not survey imagery.
              </span>
              <span className="gallery-keys" aria-hidden="true">
                <kbd>←</kbd> <kbd>→</kbd> browse · <kbd>Esc</kbd> close
              </span>
            </footer>
          </>
        ) : (
          <div className="gallery-empty">
            <p>No field photography is catalogued for this site yet.</p>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
