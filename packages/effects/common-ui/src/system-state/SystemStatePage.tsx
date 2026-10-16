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
    <section className="system-state">
      {icon && <span className="state-symbol">{icon}</span>}
      {code && <span className="eyebrow">{code}</span>}
      <h1>{heading}</h1>
      <p className="muted">{description}</p>
      {actions.length > 0 && (
        <div className="state-actions">
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
      {footer && <p className="small muted">{footer}</p>}
    </section>
  );
}
