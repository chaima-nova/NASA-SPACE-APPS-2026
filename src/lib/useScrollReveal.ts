import { useEffect, useRef, useState } from 'react';

/**
 * Reveals elements as they scroll into view, and gives panels a subtle
 * pointer-tracked tilt. Both are progressive enhancements: if
 * `prefers-reduced-motion` is set, content is shown immediately and no
 * listeners are attached.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: { threshold?: number; rootMargin?: string } = {},
) {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setRevealed(true);
      return;
    }

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setRevealed(true);
    };

    // Anything already on screen at mount reveals immediately. Done with a
    // direct measurement as well as the observer below, because the observer
    // is not guaranteed to deliver an initial callback in every environment.
    const rect = el.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < viewport && rect.bottom > 0) reveal();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal();
            observer.unobserve(entry.target);
          }
        }
      },
      {
        threshold: options.threshold ?? 0.12,
        rootMargin: options.rootMargin ?? '0px 0px -8% 0px',
      },
    );
    observer.observe(el);

    // Safety net: content must never stay permanently invisible if the
    // observer fails to fire (unsupported, throttled, or a layout edge case).
    const fallback = window.setTimeout(reveal, 2500);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, [options.threshold, options.rootMargin]);

  return { ref, revealed };
}

/**
 * Pointer-tracked 3D tilt. Sets CSS custom properties (`--tilt-x`, `--tilt-y`,
 * `--glow-x`, `--glow-y`) on the element so the styling stays in CSS.
 */
export function useTilt<T extends HTMLElement = HTMLElement>(maxDeg = 6) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reduceMotion || !finePointer) return;

    let frame = 0;

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        el.style.setProperty('--tilt-y', `${(px - 0.5) * 2 * maxDeg}deg`);
        el.style.setProperty('--tilt-x', `${(0.5 - py) * 2 * maxDeg}deg`);
        el.style.setProperty('--glow-x', `${px * 100}%`);
        el.style.setProperty('--glow-y', `${py * 100}%`);
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [maxDeg]);

  return ref;
}

/**
 * Counts up to `value` once `active` flips true, so the headline stats animate
 * rather than appearing fully formed.
 */
export function useCountUp(value: number, active: boolean, durationMs = 900): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || value === 0) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, active, durationMs]);

  return display;
}
