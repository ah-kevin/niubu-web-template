import type { ReactNode } from 'react';
import type { AuthenticationLink, AuthenticationLinkProps } from './AuthenticationForm';
import type { ReactElement } from 'react';
export interface InviteStateProps {
  heading: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  notice?: ReactNode;
  link?: AuthenticationLink;
  renderLink?: (props: AuthenticationLinkProps) => ReactElement;
}
export function InviteState({ heading, description, eyebrow, icon, notice, link, renderLink }: InviteStateProps) {
  return (
    <section className="auth-card">
      {icon && <span className="state-symbol">{icon}</span>}
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{heading}</h1>
      <p className="muted">{description}</p>
      {notice && <div className="notice small">{notice}</div>}
      {link &&
        (renderLink ? (
          renderLink({ href: link.href, children: link.label, className: 'text-link' })
        ) : (
          <a href={link.href} className="text-link">
            {link.label}
          </a>
        ))}
    </section>
  );
}
