import { useEffect, useRef, useState } from 'react';

interface SiteBackdropProps {
  /** Ground photograph of the selected site, or null when there is none. */
  url: string | null;
  /** The reader's switch; off hides the photo and leaves the plain surface. */
  enabled: boolean;
}

interface Layer {
  url: string;
  id: number;
}

/**
 * Ambient backdrop: the selected site's own photograph, faded into the page
 * surface behind the interface.
 *
 * Two rules shape this. It must stay *behind* the dark blue overlay — the photo
 * is dimmed and washed with the same near-black blue the surface already uses,
 * so panels, labels and the globe keep their contrast. And it must never flash:
 * each new site is preloaded off-screen, then cross-faded in over the previous
 * frame, so switching sites never shows a blank or half-decoded image.
 *
 * Decorative throughout: hidden from assistive tech, no pointer events.
 */
export function SiteBackdrop({ url, enabled }: SiteBackdropProps) {
  const [stack, setStack] = useState<Layer[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled || !url) return;
    const id = ++seq.current;
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (!alive) return;
      setStack((current) => {
        // Switching the backdrop off and on again must not stack duplicates.
        if (current[current.length - 1]?.url === url) return current;
        // Keep only the frame being covered plus the new one: the older layers
        // are already fully hidden underneath.
        return [...current.slice(-1), { url, id }];
      });
    };
    image.onerror = () => {
      // Leave the previous frame in place rather than flashing the raw surface.
    };
    image.src = url;
    return () => {
      alive = false;
    };
  }, [url, enabled]);

  // Shown only when the current site *has* a photo. While a new photograph
  // preloads, the previous frame stays up (no dip to black); a site with no
  // photo at all hands the surface back to the plain background instead of
  // leaving an unrelated site's picture behind the interface.
  const visible = enabled && url !== null && stack.length > 0;

  return (
    <div
      className={visible ? 'site-backdrop' : 'site-backdrop is-off'}
      aria-hidden="true"
    >
      {stack.map((layer) => (
        <div
          key={layer.id}
          className="site-backdrop-layer"
          style={{ backgroundImage: `url("${layer.url}")` }}
        />
      ))}
      <div className="site-backdrop-wash" />
    </div>
  );
}
