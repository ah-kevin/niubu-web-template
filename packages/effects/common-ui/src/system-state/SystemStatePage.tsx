import type { ReactElement, ReactNode } from 'react';
import { Button } from '@niubu/shadcn-ui/button';

export interface StateLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}
export type SystemStateAction = {
  id: string;
  label: ReactNode;
  variant?: 'default' | 'outline';
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });
export interface SystemStatePageProps {
  heading: ReactNode;
  description: ReactNode;
  code?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  actions?: readonly SystemStateAction[];
  renderLink?: (props: StateLinkProps) => ReactElement;
}
export function SystemStatePage({
  heading,
  description,
  code,
  icon,
  footer,
  actions = [],
  renderLink,
}: SystemStatePageProps) {
  return (
    <section className="system-state max-w-[450px] text-[length:var(--workspace-body-font-size)] [&>p]:leading-relaxed">
      {icon && (
        <span className="state-symbol mb-5 inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-primary-text">
          {icon}
        </span>
      )}
      {code && (
        <span className="eyebrow block text-[length:var(--workspace-caption-font-size)] font-medium tracking-wider text-muted-foreground">
          {code}
        </span>
      )}
      <h1 className="my-3 text-2xl font-semibold leading-snug">{heading}</h1>
      <p className="muted text-muted-foreground">{description}</p>
      {actions.length > 0 && (
        <div className="state-actions my-6 flex flex-wrap gap-3">
          {actions.map(action =>
            action.href !== undefined ? (
              <Button key={action.id} asChild variant={action.variant}>
                {renderLink ? (
                  renderLink({ href: action.href, children: action.label })
                ) : (
                  <a href={action.href}>{action.label}</a>
                )}
              </Button>
            ) : (
              <Button key={action.id} variant={action.variant} onClick={action.onClick}>
                {action.label}
              </Button>
            ),
          )}
        </div>
      )}
      {footer && (
        <p className="small muted text-[length:var(--workspace-caption-font-size)] text-muted-foreground">{footer}</p>
      )}
    </section>
  );
}
