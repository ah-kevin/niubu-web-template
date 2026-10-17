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
    <section className="auth-card w-full max-w-[370px]">
      {icon && (
        <span className="state-symbol inline-flex size-[62px] items-center justify-center rounded-[var(--radius)] border border-border bg-secondary text-[var(--primary-text)] mb-[27px]">
          {icon}
        </span>
      )}
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 className="mt-[13px] mb-[12px] text-[28px] [@media(max-width:700px)]:text-[27px]">{heading}</h1>
      <p className="muted text-muted-foreground">{description}</p>
      {notice && (
        <div className="notice small my-[20px] flex items-start gap-[10px] rounded-[var(--radius-md)] border border-border bg-secondary px-[14px] py-[13px] text-[12px] leading-[1.75] text-foreground [&>svg]:mt-[2px] [&>svg]:text-[var(--primary-text)] [&_strong]:text-[12px] [&_strong]:font-semibold [&_p]:mt-[3px] [&_p]:text-[11px] [&_p]:text-[var(--secondary-muted-foreground)]">
          {notice}
        </div>
      )}
      {link &&
        (renderLink ? (
          renderLink({
            href: link.href,
            children: link.label,
            className:
              'text-link inline-block mt-[24px] text-[12px] text-[var(--primary-text)] underline underline-offset-4',
          })
        ) : (
          <a
            href={link.href}
            className="text-link inline-block mt-[24px] text-[12px] text-[var(--primary-text)] underline underline-offset-4"
          >
            {link.label}
          </a>
        ))}
    </section>
  );
}
