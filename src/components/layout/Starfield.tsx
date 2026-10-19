import { useEffect, useRef } from 'react';

interface StarfieldProps {
  /** True when motion is switched off: the field is drawn once and holds. */
  still?: boolean;
}

interface Star {
  /** Starting position, in CSS pixels. */
  x: number;
  y: number;
  radius: number;
  alpha: number;
  /** Drift, in pixels per second. */
  drift: number;
  /** Twinkle phase and rate. */
  phase: number;
  rate: number;
}

const STAR_COLOURS = ['#dbe9fb', '#c7dcf2', '#a9c7e6', '#f0e2cd'];

/**
 * The landing page backdrop: a slow field of stars behind the hero.
 *
 * Drawn on a canvas rather than with a looping video, for three reasons that
 * matter here: it weighs nothing, it needs no CDN, and it stops on request. The
 * loop is time-based (not frame-based), so it drifts at the same speed on a 60 Hz
 * laptop and a 144 Hz monitor, pauses when the tab is hidden, and under
 * `still` — reduced motion, or blind mode — it paints one frame and never
 * schedules another.
 *
 * Decorative throughout: hidden from assistive tech, no pointer events.
 */
export function Starfield({ still = false }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frame = 0;
    let started = 0;

    const seed = () => {
      // One star per ~7,000 px², clamped so a phone still gets a sky and a 4K
      // monitor does not turn into a dust storm.
      const count = Math.round(Math.min(320, Math.max(90, (width * height) / 7000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.35 + Math.random() * 1.25,
        alpha: 0.25 + Math.random() * 0.6,
        drift: 2 + Math.random() * 9,
        phase: Math.random() * Math.PI * 2,
        rate: 0.0004 + Math.random() * 0.0011,
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const paint = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        // Wrap rather than reset, so the field never visibly jumps.
        const y = (star.y + (time * star.drift) / 1000) % height;
        const twinkle = still ? 0.8 : 0.62 + 0.38 * Math.sin(time * star.rate + star.phase);
        ctx.globalAlpha = star.alpha * twinkle;
        ctx.fillStyle = STAR_COLOURS[i % STAR_COLOURS.length];
        ctx.beginPath();
        ctx.arc(star.x, y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (time: number) => {
      if (!started) started = time;
      paint(time - started);
      frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      window.cancelAnimationFrame(frame);
      if (still || document.hidden) {
        // A held frame is still a frame: the sky must not be empty.
        paint(0);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    resize();
    start();

    const observer = new ResizeObserver(() => {
      resize();
      start();
    });
    observer.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
      } else {
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [still]);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}
