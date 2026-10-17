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
    <header className="pattern-page-header flex min-w-0 max-w-full flex-wrap items-start justify-between gap-[var(--workspace-heading-gap)] mb-[var(--workspace-section-gap)]">
      <div className="pattern-heading-copy min-w-0 flex-[1_1_260px]">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {headingLevel === 1 ? (
          <h1 className="mt-0 mb-[var(--workspace-heading-gap)] text-[length:var(--workspace-title-font-size)] font-[650] tracking-[-0.025em] pattern-title min-w-0 [overflow-wrap:anywhere] break-normal leading-[1.35]">
            {title}
          </h1>
        ) : (
          <h2 className="pattern-title min-w-0 [overflow-wrap:anywhere] break-normal leading-[1.35]">{title}</h2>
        )}
        {description && (
          <p className="pattern-description text-[length:var(--workspace-caption-font-size)] leading-[1.8] text-muted-foreground">
            {description}
          </p>
        )}
        {meta && <div className="pattern-header-meta mt-[var(--workspace-heading-gap)]">{meta}</div>}
      </div>
      {actions && (
        <div className="pattern-header-actions flex max-w-full flex-[0_1_auto] flex-wrap gap-[8px] pt-[6px] [@media(max-width:700px)]:w-full [@media(max-width:700px)]:pt-0">
          {actions}
        </div>
      )}
    </header>
  );
}
