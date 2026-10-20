import { lazy, Suspense, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronsLeft, ChevronsRight, MenuExpand, MenuFold, Pin, PinOff } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { TreeNavigation, type LinkRenderer, type NavigationNode } from '@niubu/menu-ui';
import { preferenceLimits } from '@niubu/core-preferences';
import type { BusinessLayoutModel } from './layout-model';
import { PendingOverlay } from './PendingOverlay';
export type LayoutLabels = Readonly<{
  skipContent: string;
  close?: string;
  sidebar: string;
  navigation: string;
  mobileNavigation: string;
  openNavigation: string;
  workspaceNavigation: string;
  pageContext: string;
  recovery: string;
  restoreLayout: string;
  collapse: string;
  expand: string;
  pin: string;
  unpin: string;
  resize: string;
  secondaryNavigation: string;
  topNavigation: string;
}>;
export type SidebarControls = {
  width: number;
  collapsed: boolean;
  fixed: boolean;
  draggable: boolean;
  showCollapse: boolean;
  showFixed: boolean;
  onWidthChange: (width: number) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onFixedChange: (fixed: boolean) => void;
};
/** Only validated navigation, render slots and controlled callbacks cross this boundary. */
export type AppLayoutProps = {
  children: ReactNode;
  brand: string;
  density: 'standard' | 'compact';
  model: BusinessLayoutModel;
  labels: LayoutLabels;
  navigation: readonly NavigationNode[];
  primaryNodes?: readonly NavigationNode[];
  secondaryNodes?: readonly NavigationNode[];
  topNodes?: readonly NavigationNode[];
  selectedPrimaryId?: string;
  selectedTopId?: string;
  onSelectPrimary?: (id: string) => void;
  onSelectTop?: (id: string) => void;
  renderLink: LinkRenderer;
  expandedIds: readonly string[];
  order?: Readonly<Record<string, readonly string[]>>;
  onExpand: (id: string, open: boolean) => void;
  onReorder?: (parentId: string, ids: readonly string[]) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onRestoreLayout: () => void;
  onSidebarTemporaryExpansionChange?: (expanded: boolean) => void;
  onSidebarInteractionChange?: (region: 'primary' | 'secondary', input: 'hover' | 'focus', active: boolean) => void;
  sidebarControls?: SidebarControls;
  showCollapsedTitle?: boolean;
  menuStyle?: 'plain' | 'rounded';
  logo?: ReactNode;
  topActions?: ReactNode;
  headerMenuAlign?: 'start' | 'center' | 'end';
  foundationTools?: (options: { headerAvailable: boolean; headerTarget: HTMLDivElement | null }) => ReactNode;
  notifications?: ReactNode;
  userMenu?: ReactNode;
  scopeSelector?: ReactNode;
  sidebarBottom?: ReactNode;
  mobileAccount?: ReactNode;
  breadcrumbs?: ReactNode;
  mode?: ReactNode;
  tabs?: ReactNode;
  footer?: ReactNode;
};
const MobileDrawer = lazy(() => import('./MobileDrawer'));
function sidebarExpansionTrigger(target: HTMLElement): HTMLElement | null {
  const pane = target.closest('.layout-primary-pane,.layout-secondary-pane');
  if (!pane) return null;
  const rail = target.closest<HTMLButtonElement>('.layout-selectors > button');
  if (rail) return rail;
  let item = target.closest<HTMLLIElement>('li[data-navigation-id]');
  let branch: HTMLButtonElement | null = null;
  // The outer branch survives compact rendering; nested descendants may disappear.
  while (item && pane.contains(item)) {
    const button = item.querySelector<HTMLButtonElement>(':scope > button.navigation-branch');
    if (button) branch = button;
    item = item.parentElement?.closest<HTMLLIElement>('li[data-navigation-id]') ?? null;
  }
  return branch ?? target.closest<HTMLAnchorElement>('a.nav-link');
}
export function BusinessLayout(p: AppLayoutProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const contentId = useId();
  const temporaryTrigger = useRef<HTMLElement | null>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const m = p.model;
  const controls = p.sidebarControls;
  const outsideRecovery = m.recoveryRequired && (!m.headerEnabled || m.headerHidden);
  const previousRecovery = useRef(m.recoveryRequired);
  useEffect(() => {
    if (m.sidebarVisuallyCollapsed) temporaryTrigger.current = null;
  }, [m.sidebarVisuallyCollapsed]);
  useEffect(() => {
    if (previousRecovery.current && !m.recoveryRequired && document.activeElement === document.body)
      document.getElementById('main-content')?.focus();
    previousRecovery.current = m.recoveryRequired;
  }, [m.recoveryRequired]);
  const resize = (width: number) =>
    controls?.onWidthChange(
      Math.round(Math.max(preferenceLimits.sidebarWidth[0], Math.min(preferenceLimits.sidebarWidth[1], width))),
    );
  const tree = (
    nodes: readonly NavigationNode[],
    label: string,
    orientation: 'vertical' | 'horizontal' = 'vertical',
    compact = false,
  ) => (
    <TreeNavigation
      nodes={nodes}
      label={label}
      expandedIds={p.expandedIds}
      renderLink={p.renderLink}
      order={p.order}
      onExpand={p.onExpand}
      onReorder={p.onReorder}
      orientation={orientation}
      compact={compact}
      showTitle={p.showCollapsedTitle}
      style={p.menuStyle}
      onBranchActivate={
        orientation === 'vertical'
          ? () => {
              if (m.sidebarCollapsed) p.onSidebarTemporaryExpansionChange?.(true);
            }
          : undefined
      }
    />
  );
  const selectors = (
    nodes: readonly NavigationNode[],
    label: string,
    selected: string | undefined,
    onSelect: ((id: string) => void) | undefined,
  ) => (
    <nav className="layout-selectors flex flex-col gap-[4px]" aria-label={label}>
      {nodes.map(node => (
        <button
          key={node.id}
          type="button"
          className="nav-link my-[2px] flex min-h-[var(--row-height)] w-full items-center gap-[12px] rounded-[7px] border-0 bg-transparent px-[12px] py-[8px] text-left [font-family:inherit] text-[.8125rem] text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-pressed={selected === node.id}
          onClick={() => {
            if (m.sidebarCollapsed && label !== p.labels.topNavigation) p.onSidebarTemporaryExpansionChange?.(true);
            onSelect?.(node.id);
          }}
        >
          {node.icon}
          <span>{node.label}</span>
        </button>
      ))}
    </nav>
  );
  const desktopCollapse = m.viewport === 'desktop' && m.sidebarEnabled && controls;
  const navigationIcon = (desktopCollapse ? !controls.collapsed : m.showSidebar) ? (
    <MenuFold aria-hidden="true" />
  ) : (
    <MenuExpand aria-hidden="true" />
  );
  const opener = desktopCollapse ? (
    controls.showCollapse && (
      <Button
        size="icon"
        variant="ghost"
        className="desktop-nav-trigger"
        aria-label={controls.collapsed ? p.labels.expand : p.labels.collapse}
        aria-pressed={controls.collapsed}
        onClick={() => {
          p.onSidebarTemporaryExpansionChange?.(false);
          controls.onCollapsedChange(!controls.collapsed);
        }}
      >
        {navigationIcon}
      </Button>
    )
  ) : (
    <Button
      ref={trigger}
      data-slot="sheet-trigger"
      data-state={p.mobileOpen ? 'open' : 'closed'}
      aria-controls={contentId}
      className={m.recoveryRequired ? 'recovery-nav-trigger' : 'mobile-nav-trigger'}
      size="icon"
      variant="ghost"
      aria-haspopup="dialog"
      aria-expanded={p.mobileOpen}
      aria-label={p.labels.openNavigation}
      onClick={() => p.onMobileOpenChange(true)}
    >
      {navigationIcon}
    </Button>
  );
  const style = {
    '--layout-primary-space': `${m.primarySpace}px`,
    '--layout-primary-width': `${m.primaryWidth}px`,
    '--layout-secondary-space': `${m.secondarySpace}px`,
    '--layout-secondary-width': `${m.secondaryWidth}px`,
    '--layout-header-height': `${m.headerHeight}px`,
    '--layout-header-space': `${(m.headerEnabled && !m.headerHidden) || outsideRecovery ? m.headerHeight : 0}px`,
    '--layout-tab-height': `${m.tabbarHeight}px`,
    '--layout-footer-height': `${m.footerHeight}px`,
    '--layout-sidebar-offset': `${m.sidebarOffset}px`,
    '--layout-tab-offset': `${m.tabbarOffset}px`,
    '--layout-content-width': `${m.fixedWidth}px`,
    '--layout-content-padding': `${m.contentPadding}px`,
    // Upward focus reveal can restore auto-hidden chrome. Reserve its enabled fixed extent,
    // independent of transient scroll visibility, without changing layout or padding.
    '--focus-reveal-inset-top': `${Math.max(
      m.headerEnabled && m.headerFixed ? m.headerHeight : 0,
      m.tabbarEnabled && m.tabbarFixed ? (m.headerEnabled ? m.headerHeight : 0) + m.tabbarHeight : 0,
    )}px`,
    '--focus-reveal-inset-bottom': `${m.footerEnabled && m.footerFixed ? m.footerHeight : 0}px`,
  } as CSSProperties;
  return (
    <div
      className="business-shell foundation-layout"
      style={style}
      data-layout-mode={m.mode}
      data-viewport={m.viewport}
      data-layout-density={p.density}
      data-sidebar-collapsed={m.sidebarCollapsed}
      data-sidebar-visually-collapsed={m.sidebarVisuallyCollapsed}
      data-header-placement={m.headerPlacement}
      data-header-fixed={m.headerFixed}
      data-header-hidden={m.headerHidden}
      data-sidebar-fixed={m.sidebarFixed}
      data-content-mode={m.contentMode}
      data-scroll-host={m.scrollHost}
      onClickCapture={event => {
        if (!m.sidebarCollapsed) return;
        const current = sidebarExpansionTrigger(event.target as HTMLElement);
        if (current) temporaryTrigger.current = current;
      }}
      onFocusCapture={event => {
        if (!m.sidebarCollapsed) return;
        const current = sidebarExpansionTrigger(event.target as HTMLElement);
        if (current) temporaryTrigger.current = current;
      }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !m.sidebarCollapsed || m.sidebarVisuallyCollapsed) return;
        event.preventDefault();
        event.stopPropagation();
        const current = sidebarExpansionTrigger(event.target as HTMLElement);
        const target = current ?? temporaryTrigger.current;
        if (target?.isConnected) target.focus();
        else document.getElementById('main-content')?.focus();
        p.onSidebarTemporaryExpansionChange?.(false);
      }}
    >
      <a
        className="skip-link fixed top-[12px] left-[12px] z-[100] -translate-y-[150%] rounded-[8px] border border-ring bg-card px-[20px] py-[12px] text-primary-text focus:translate-y-0"
        href="#main-content"
      >
        {p.labels.skipContent}
      </a>
      {m.sidebarEnabled && (
        <aside
          className="desktop-sidebar layout-primary-pane"
          aria-label={p.labels.sidebar}
          data-theme-region="sidebar"
          data-visually-collapsed={m.sidebarVisuallyCollapsed || m.primaryKind === 'rail'}
          onMouseEnter={() => p.onSidebarInteractionChange?.('primary', 'hover', true)}
          onMouseLeave={() => p.onSidebarInteractionChange?.('primary', 'hover', false)}
          onFocusCapture={() => p.onSidebarInteractionChange?.('primary', 'focus', true)}
          onBlurCapture={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              p.onSidebarInteractionChange?.('primary', 'focus', false);
          }}
        >
          <div className="layout-logo flex shrink-0 items-center overflow-hidden px-[12px]">{p.logo}</div>
          <div className="layout-navigation-scroll">
            {m.primaryKind === 'rail'
              ? selectors(p.primaryNodes ?? [], p.labels.navigation, p.selectedPrimaryId, p.onSelectPrimary)
              : tree(p.primaryNodes ?? p.navigation, p.labels.navigation, 'vertical', m.sidebarVisuallyCollapsed)}
          </div>
          <div className="sidebar-bottom shrink-0 overflow-hidden px-[12px] py-[8px]">
            {p.sidebarBottom}
            <div className="sidebar-controls flex items-center justify-between gap-[2px]">
              {controls?.showCollapse && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="sidebar-collapse-control size-[24px] flex-[0_0_24px] rounded-[3px] bg-muted p-[4px] text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-accent"
                  aria-label={controls.collapsed ? p.labels.expand : p.labels.collapse}
                  aria-pressed={controls.collapsed}
                  onClick={() => {
                    p.onSidebarTemporaryExpansionChange?.(false);
                    controls.onCollapsedChange(!controls.collapsed);
                  }}
                >
                  {controls.collapsed ? (
                    <ChevronsRight size={14} aria-hidden="true" />
                  ) : (
                    <ChevronsLeft size={14} aria-hidden="true" />
                  )}
                </Button>
              )}
              {controls?.showFixed && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="sidebar-fixed-control ml-auto size-[24px] flex-[0_0_24px] rounded-[3px] bg-muted p-[4px] text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-accent"
                  aria-label={controls.fixed ? p.labels.unpin : p.labels.pin}
                  aria-pressed={controls.fixed}
                  onClick={() => controls.onFixedChange(!controls.fixed)}
                >
                  {controls.fixed ? <Pin size={14} aria-hidden="true" /> : <PinOff size={14} aria-hidden="true" />}
                </Button>
              )}
            </div>
          </div>
        </aside>
      )}
      {m.secondarySidebarEnabled && (
        <aside
          className="layout-secondary-pane"
          aria-label={p.labels.secondaryNavigation}
          data-theme-region="submenu"
          data-visually-collapsed={m.sidebarVisuallyCollapsed}
          onMouseEnter={() => p.onSidebarInteractionChange?.('secondary', 'hover', true)}
          onMouseLeave={() => p.onSidebarInteractionChange?.('secondary', 'hover', false)}
          onFocusCapture={() => p.onSidebarInteractionChange?.('secondary', 'focus', true)}
          onBlurCapture={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              p.onSidebarInteractionChange?.('secondary', 'focus', false);
          }}
        >
          <div className="layout-navigation-scroll">
            {tree(p.secondaryNodes ?? [], p.labels.secondaryNavigation, 'vertical', m.sidebarVisuallyCollapsed)}
          </div>
        </aside>
      )}
      {m.sidebarEnabled && controls?.draggable && !controls.collapsed && (
        <div
          role="separator"
          tabIndex={0}
          className="sidebar-resize-handle"
          aria-label={p.labels.resize}
          aria-orientation="vertical"
          aria-valuemin={preferenceLimits.sidebarWidth[0]}
          aria-valuemax={preferenceLimits.sidebarWidth[1]}
          aria-valuenow={controls.width}
          onKeyDown={event => {
            const next =
              event.key === 'Home'
                ? preferenceLimits.sidebarWidth[0]
                : event.key === 'End'
                  ? preferenceLimits.sidebarWidth[1]
                  : event.key === 'ArrowRight'
                    ? controls.width + 8
                    : event.key === 'ArrowLeft'
                      ? controls.width - 8
                      : null;
            if (next !== null) {
              event.preventDefault();
              resize(next);
            }
          }}
          onPointerDown={event => {
            drag.current = { x: event.clientX, width: controls.width };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (drag.current) resize(drag.current.width + event.clientX - drag.current.x);
          }}
          onPointerUp={event => {
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        />
      )}
      <header
        className={outsideRecovery ? 'layout-recovery' : 'workspace-header'}
        data-theme-region="header"
        role={outsideRecovery ? 'region' : undefined}
        aria-label={outsideRecovery ? p.labels.recovery : undefined}
        aria-hidden={(m.headerHidden && !outsideRecovery) || undefined}
        inert={(m.headerHidden && !outsideRecovery) || undefined}
      >
        <div className="context-actions flex min-w-0 items-center gap-[8px]">
          {opener}
          {p.breadcrumbs}
          {m.recoveryRequired && (
            <Button variant="outline" onClick={p.onRestoreLayout}>
              {p.labels.restoreLayout}
            </Button>
          )}
          {m.headerPlacement === 'full' && !m.sidebarEnabled && p.logo}
          {p.scopeSelector}
          {p.mode && (
            <section className="workspace-page-context relative min-w-0 shrink-0" aria-label={p.labels.pageContext}>
              {p.mode}
            </section>
          )}
        </div>
        <div
          className={m.topNavigationEnabled && !outsideRecovery ? 'layout-top-navigation' : undefined}
          style={{ justifyContent: p.headerMenuAlign ?? 'start' }}
        >
          {m.topNavigationEnabled &&
            !outsideRecovery &&
            (m.mode === 'horizontal'
              ? tree(p.topNodes ?? p.navigation, p.labels.topNavigation, 'horizontal')
              : selectors(p.topNodes ?? [], p.labels.topNavigation, p.selectedTopId, p.onSelectTop))}
        </div>
        <div className="header-actions flex min-w-0 items-center gap-[8px]">
          <div ref={setHeaderTarget} className="foundation-header-slot" />
          {p.topActions}
          {p.notifications}
          {p.userMenu}
        </div>
      </header>
      {p.foundationTools?.({
        headerAvailable:
          (m.headerEnabled && !m.headerHidden && !m.contentMaximized) || (m.viewport === 'mobile' && outsideRecovery),
        headerTarget,
      })}
      <div className="workspace-frame">
        {m.tabbarEnabled && (
          <div
            className="layout-tab-slot"
            data-slot="page-tabs"
            data-fixed={m.tabbarFixed}
            data-hidden={m.tabbarHidden}
            style={{ height: m.tabbarHeight }}
          >
            {p.tabs}
          </div>
        )}
        <main id="main-content" className="workspace-main" tabIndex={-1}>
          {p.children}
        </main>
        {m.footerEnabled && (
          <footer className="workspace-footer" data-fixed={m.footerFixed}>
            {p.footer}
          </footer>
        )}
      </div>
      {p.mobileOpen && (
        <Suspense
          fallback={
            <PendingOverlay
              onCancel={() => {
                p.onMobileOpenChange(false);
                trigger.current?.focus();
              }}
            />
          }
        >
          <MobileDrawer
            contentId={contentId}
            brand={p.brand}
            labels={p.labels}
            tree={{
              nodes: p.navigation,
              expandedIds: p.expandedIds,
              onExpand: p.onExpand,
              order: p.order,
              onReorder: p.onReorder,
            }}
            renderLink={p.renderLink}
            onOpenChange={p.onMobileOpenChange}
            mobileAccount={p.mobileAccount}
            returnFocus={() => trigger.current?.focus()}
          />
        </Suspense>
      )}
    </div>
  );
}
