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
    <nav className="primary-navigation" aria-label={label}>
      {[...new Set(items.map(item => item.group))].map(group => (
        <div className="nav-group" key={group}>
          <p>{group}</p>
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
                  className: item.active ? 'nav-link active' : 'nav-link',
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
                            <span className="nav-badge">{item.badge}</span>
                          </>
                        )}
                      </span>
                      {item.active && <span className="nav-indicator" />}
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
