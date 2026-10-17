import { Fragment, type ReactNode } from 'react';
export type NavigationItem = Readonly<{
  id: string;
  href: string;
  label: string;
  group: string;
  icon?: ReactNode;
  active: boolean;
  badge?: string | number;
  target?: '_blank';
  rel?: 'noopener noreferrer';
  external?: boolean;
}>;
export type LinkProps = {
  href: string;
  target?: '_blank';
  rel?: 'noopener noreferrer';
  /** Binding hint: consume this before spreading anchor DOM props. */
  external?: boolean;
  className?: string;
  'aria-current'?: 'page';
  onClick?: () => void;
  children: ReactNode;
};
export type LinkRenderer = (props: LinkProps) => ReactNode;
export function Navigation({
  items,
  label,
  renderLink,
  onNavigate,
}: {
  items: readonly NavigationItem[];
  label: string;
  renderLink: LinkRenderer;
  onNavigate?: () => void;
}) {
  return (
    <nav className="primary-navigation flex-1 overflow-y-auto px-px [scrollbar-width:thin]" aria-label={label}>
      {[...new Set(items.map(item => item.group))].map(group => (
        <div className="nav-group mb-[19px]" key={group}>
          <p className="mb-[7px] px-[13px] text-[10px] tracking-[1px] text-muted-foreground">{group}</p>
          {items
            .filter(item => item.group === group)
            .map(item => (
              <Fragment key={item.id}>
                {renderLink({
                  href: item.href,
                  ...(item.target === undefined ? {} : { target: item.target }),
                  ...(item.target === '_blank'
                    ? { rel: 'noopener noreferrer' }
                    : item.rel === undefined
                      ? {}
                      : { rel: item.rel }),
                  ...(item.external === undefined ? {} : { external: item.external }),
                  className: `nav-link my-[2px] flex min-h-[var(--row-height)] items-center gap-[12px] rounded-[7px] px-[12px] py-[8px] text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground${item.active ? ' active' : ''}`,
                  'aria-current': item.active ? 'page' : undefined,
                  onClick: onNavigate,
                  children: (
                    <>
                      {item.icon}
                      <span>
                        {item.label}
                        {item.badge !== undefined && (
                          <>
                            {' '}
                            <span className="nav-badge inline-block rounded-[var(--radius)] bg-muted px-[5px] text-[.7rem] leading-[1.4] text-muted-foreground align-middle">
                              {item.badge}
                            </span>
                          </>
                        )}
                      </span>
                      {item.active && <span className="nav-indicator ml-auto size-[5px] rounded-full bg-primary" />}
                    </>
                  ),
                })}
              </Fragment>
            ))}
        </div>
      ))}
    </nav>
  );
}

export { TreeNavigation } from './TreeNavigation';
export type { NavigationNode, TreeNavigationProps } from './TreeNavigation';
