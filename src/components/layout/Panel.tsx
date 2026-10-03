import type { ReactNode } from 'react';
import { useScrollReveal, useTilt } from '../../lib/useScrollReveal';

interface PanelProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Glass panel with a scroll-in reveal and a subtle pointer-tracked tilt.
 * The tilt is applied to an inner wrapper so the panel's own layout box stays
 * stable and neighbouring panels do not shift.
 */
export function Panel({ title, subtitle, className, children }: PanelProps) {
  const { ref, revealed } = useScrollReveal<HTMLElement>();
  const tiltRef = useTilt<HTMLDivElement>(4);

  const classes = ['panel', className, revealed ? 'is-revealed' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <section ref={ref} className={classes}>
      <div ref={tiltRef} className="panel-tilt">
        <header className="panel-head">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
        <div className="panel-body">{children}</div>
      </div>
    </section>
  );
}
