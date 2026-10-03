import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, className, children }: PanelProps) {
  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      <header className="panel-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
