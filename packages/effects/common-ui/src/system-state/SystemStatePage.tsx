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
    <section className="system-state max-w-[450px] [&>p]:text-[12px] [&>p]:leading-[1.9]">
      {icon && (
        <span className="state-symbol inline-flex size-[62px] items-center justify-center rounded-[var(--radius)] border border-border bg-secondary text-[var(--primary-text)] mb-[27px]">
          {icon}
        </span>
      )}
      {code && <span className="eyebrow">{code}</span>}
      <h1 className="my-[14px] text-[27px]">{heading}</h1>
      <p className="muted text-muted-foreground">{description}</p>
      {actions.length > 0 && (
        <div className="state-actions my-[28px] flex flex-wrap gap-[12px] [&_[data-slot=button]]:text-[11px]">
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
      {footer && <p className="small muted text-muted-foreground">{footer}</p>}
    </section>
  );
}
