import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
  headingLevel = 1,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  headingLevel?: 1 | 2;
}) {
  return (
    <header className="pattern-page-header">
      <div className="pattern-heading-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {headingLevel === 1 ? <h1 className="pattern-title">{title}</h1> : <h2 className="pattern-title">{title}</h2>}
        {description && <p className="pattern-description">{description}</p>}
        {meta && <div className="pattern-header-meta">{meta}</div>}
      </div>
      {actions && <div className="pattern-header-actions">{actions}</div>}
    </header>
  );
}
