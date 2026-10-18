import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Flat instrument card: solid surface, hairline border, no blur or tilt.
 * The header row is deliberately fixed-height so stacked cards stay aligned.
 */
export function Panel({ title, subtitle, className, actions, children }: PanelProps) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')}>
      <header className="card-head">
        <div className="card-head-text">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}
