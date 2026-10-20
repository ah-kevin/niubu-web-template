import type { ReactNode } from 'react';
import { cn } from '@niubu/shadcn-ui/cn';

export function ExamplePage({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'example-page min-w-0 [margin:calc(-1*max(var(--workspace-card-padding),var(--layout-content-padding,0px)))]',
        className,
      )}
    >
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-[var(--workspace-heading-gap)] border-b border-border bg-card px-6 py-5 max-sm:px-4">
        <div className="min-w-0 flex-1 basis-64">
          <h1 className="mb-[var(--workspace-heading-gap)] text-[length:var(--workspace-title-font-size)] leading-snug font-[650] tracking-tight [overflow-wrap:anywhere]">
            {title}
          </h1>
          {description && <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="grid min-w-0 gap-[var(--workspace-section-gap)] p-[var(--workspace-card-padding)]">
        {children}
      </div>
    </div>
  );
}

export function ExampleSection({
  title,
  description,
  actions,
  footer,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn('example-card min-w-0 rounded-[var(--radius)] border border-border bg-card', className)}
    >
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-[var(--workspace-card-padding)] py-3">
        <div className="min-w-0">
          <h2 className="text-base leading-snug font-semibold [overflow-wrap:anywhere]">{title}</h2>
          {description && <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div
        className={cn(
          'grid min-w-0 gap-4 p-[var(--workspace-card-padding)] [&>[data-slot=button]]:justify-self-start',
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer && (
        <footer className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-border p-[var(--workspace-card-padding)]">
          {footer}
        </footer>
      )}
    </section>
  );
}

export function ExampleDetails({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="min-w-0 rounded-[var(--radius)] border border-border bg-card text-sm">
      <summary className="cursor-pointer px-[var(--workspace-card-padding)] py-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {title}
      </summary>
      <div className="grid min-w-0 gap-3 border-t border-border p-[var(--workspace-card-padding)] leading-relaxed text-muted-foreground [&_pre]:max-h-72 [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
        {children}
      </div>
    </details>
  );
}
