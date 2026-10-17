import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from '@niubu/icons';
import { useOverlayBoundaryRef } from '@niubu/shadcn-ui/overlay-ownership';
import { normalizeMenuOrder, moveMenuItem } from './menu-order';
import type { LinkRenderer } from './index';
export type NavigationNode = Readonly<
  | {
      kind: 'branch';
      id: string;
      label: string;
      icon?: ReactNode;
      badge?: string | number;
      presentation?: 'group';
      children: readonly NavigationNode[];
    }
  | {
      kind: 'leaf';
      id: string;
      label: string;
      icon?: ReactNode;
      href: string;
      active: boolean;
      badge?: string | number;
      target?: '_blank';
      rel?: 'noopener noreferrer';
      external?: boolean;
    }
>;
export type TreeNavigationProps = {
  nodes: readonly NavigationNode[];
  label: string;
  expandedIds: readonly string[];
  renderLink: LinkRenderer;
  order?: Readonly<Record<string, readonly string[]>>;
  onExpand: (id: string, open: boolean) => void;
  onReorder?: (parentId: string, ids: readonly string[]) => void;
  onNavigate?: () => void;
  onBranchActivate?: () => void;
  orientation?: 'vertical' | 'horizontal';
  compact?: boolean;
  showTitle?: boolean;
  style?: 'rounded' | 'plain';
};
/** Disclosure navigation: native links and buttons, never an incomplete ARIA tree/menu. */
export function TreeNavigation(p: TreeNavigationProps) {
  const instance = useId();
  const nav = useRef<HTMLElement>(null);
  const { orientation, nodes: roots, expandedIds: openIds, onExpand: expand } = p;
  const hasHorizontalOverlay =
    orientation === 'horizontal' &&
    roots.some(node => node.kind === 'branch' && node.presentation !== 'group' && openIds.includes(node.id));
  const boundaryRef = useOverlayBoundaryRef(nav, hasHorizontalOverlay ? JSON.stringify(openIds) : false);
  useEffect(() => {
    if (orientation !== 'horizontal') return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !nav.current?.contains(event.target))
        roots.forEach(node => {
          if (node.kind === 'branch' && openIds.includes(node.id)) expand(node.id, false);
        });
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [orientation, roots, openIds, expand]);
  function list(nodes: readonly NavigationNode[], parent = '$root', depth = 0, indent = 0): ReactNode {
    const ids = normalizeMenuOrder(
      nodes.map(n => n.id),
      p.order?.[parent],
    );
    return (
      <ul
        className="navigation-list m-0 list-none p-0"
        data-depth={depth}
        style={{ '--navigation-indent': `${indent * 18}px` } as CSSProperties}
      >
        {ids.map(id => {
          const node = nodes.find(n => n.id === id)!;
          const open = node.kind === 'branch' && (node.presentation === 'group' || p.expandedIds.includes(id));
          const group = node.kind === 'branch' && node.presentation === 'group';
          const contentId = `${instance}-${encodeURIComponent(id)}`;
          const active = (n: NavigationNode): boolean => (n.kind === 'leaf' ? n.active : n.children.some(active));
          return (
            <li
              key={id}
              data-navigation-id={id}
              className={group ? 'navigation-group' : 'navigation-item'}
              draggable={!!p.onReorder && !group}
              onDragStart={event => {
                event.stopPropagation();
                if (p.onReorder && !group) event.dataTransfer.setData('text/niubu-navigation', id);
              }}
              onDragOver={event => {
                if (p.onReorder) event.preventDefault();
              }}
              onDrop={event => {
                if (!p.onReorder || group) return;
                event.preventDefault();
                event.stopPropagation();
                const source = event.dataTransfer.getData('text/niubu-navigation');
                if (!ids.includes(source) || source === id) return;
                const next = ids.filter(value => value !== source);
                next.splice(next.indexOf(id), 0, source);
                p.onReorder(parent, next);
              }}
              onKeyDown={event => {
                if (!p.onReorder || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                event.stopPropagation();
                p.onReorder(parent, moveMenuItem(ids, id, event.key === 'ArrowUp' ? -1 : 1));
              }}
            >
              {node.kind === 'leaf' ? (
                p.renderLink({
                  href: node.href,
                  ...(node.target === undefined ? {} : { target: node.target }),
                  ...(node.target === '_blank'
                    ? { rel: 'noopener noreferrer' }
                    : node.rel === undefined
                      ? {}
                      : { rel: node.rel }),
                  ...(node.external === undefined ? {} : { external: node.external }),
                  className: `nav-link my-[2px] flex min-h-[var(--row-height)] items-center gap-[12px] rounded-[7px] px-[12px] py-[8px] text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground${node.active ? ' active' : ''}`,
                  'aria-current': node.active ? 'page' : undefined,
                  onClick: p.onNavigate,
                  children: (
                    <>
                      {node.icon}
                      <span className="navigation-label">
                        {node.label}
                        {node.badge !== undefined && (
                          <>
                            {' '}
                            <span className="nav-badge inline-block rounded-[var(--radius)] bg-muted px-[5px] text-[.7rem] leading-[1.4] text-muted-foreground align-middle">
                              {node.badge}
                            </span>
                          </>
                        )}
                      </span>
                    </>
                  ),
                })
              ) : group ? (
                <p className="navigation-group-label px-[12px] py-[6px] text-[.7rem] text-muted-foreground">
                  {node.label}
                  {node.badge !== undefined && (
                    <>
                      {' '}
                      <span className="nav-badge inline-block rounded-[var(--radius)] bg-muted px-[5px] text-[.7rem] leading-[1.4] text-muted-foreground align-middle">
                        {node.badge}
                      </span>
                    </>
                  )}
                </p>
              ) : (
                <button
                  type="button"
                  className={`nav-link navigation-branch my-[2px] flex min-h-[var(--row-height)] items-center gap-[12px] rounded-[7px] px-[12px] py-[8px] text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground w-full border-0 bg-transparent text-left [font-family:inherit]${active(node) ? ' active-parent' : ''}`}
                  aria-expanded={open && !p.compact}
                  aria-controls={contentId}
                  onClick={() => {
                    p.onBranchActivate?.();
                    p.onExpand(id, p.compact ? true : !open);
                  }}
                >
                  {node.icon}
                  <span className="navigation-label">
                    {node.label}
                    {node.badge !== undefined && (
                      <>
                        {' '}
                        <span className="nav-badge inline-block rounded-[var(--radius)] bg-muted px-[5px] text-[.7rem] leading-[1.4] text-muted-foreground align-middle">
                          {node.badge}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="navigation-chevron ml-auto inline-flex flex-none items-center" aria-hidden="true">
                    {open ? (
                      <ChevronDown size={14} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={14} aria-hidden="true" />
                    )}
                  </span>
                </button>
              )}
              {node.kind === 'branch' && (
                <div
                  id={contentId}
                  hidden={!open || (!!p.compact && !group)}
                  className="navigation-children"
                  data-theme-region={!group ? 'submenu' : undefined}
                >
                  {open &&
                    (!p.compact || group) &&
                    list(
                      node.children,
                      id,
                      depth + 1,
                      indent + (group || (p.orientation === 'horizontal' && depth === 0) ? 0 : 1),
                    )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <nav
      ref={boundaryRef}
      onKeyDown={event => {
        if (p.orientation !== 'horizontal' || event.key !== 'Escape') return;
        const target = event.target as HTMLElement;
        let item = target.closest<HTMLLIElement>('li[data-navigation-id]');
        while (item && item.parentElement?.parentElement !== event.currentTarget)
          item = item.parentElement?.closest<HTMLLIElement>('li[data-navigation-id]') ?? null;
        const id = item?.dataset.navigationId;
        if (id && p.expandedIds.includes(id)) {
          event.preventDefault();
          event.stopPropagation();
          p.onExpand(id, false);
          item?.querySelector<HTMLButtonElement>(':scope > button')?.focus();
        }
      }}
      onBlurCapture={event => {
        if (p.orientation === 'horizontal' && !event.currentTarget.contains(event.relatedTarget as Node | null))
          p.nodes.forEach(node => {
            if (node.kind === 'branch' && p.expandedIds.includes(node.id)) p.onExpand(node.id, false);
          });
      }}
      className="primary-navigation tree-navigation flex-1 overflow-y-auto px-px [scrollbar-width:thin]"
      aria-label={p.label}
      data-orientation={p.orientation ?? 'vertical'}
      data-compact={!!p.compact}
      data-show-title={!!p.showTitle}
      data-menu-style={p.style ?? 'rounded'}
    >
      {list(p.nodes)}
    </nav>
  );
}
