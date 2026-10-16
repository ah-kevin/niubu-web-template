import { foundationDimensions } from '@niubu/core-design';
import type { CorePreferences } from '@niubu/core-preferences';

/** Session-only inputs never alter persisted preferences. The document owns page scrolling. */
export function resolveBusinessLayout(
  p: CorePreferences,
  viewport: 'desktop' | 'mobile',
  session: { hovered?: boolean; sidebarExpanded?: boolean; contentMaximized?: boolean; scrollHidden?: boolean } = {},
) {
  const mode = p.layout.mode;
  const full = mode === 'full-content' || !!session.contentMaximized;
  const desktop = viewport === 'desktop';
  const two = p.menu.split && (mode === 'two-column' || mode === 'mixed-two-column');
  const headerPlacement = mode === 'vertical' || mode === 'two-column' ? 'content' : 'full';
  const headerEnabled = p.header.enabled && !full;
  const headerFixed = p.header.mode !== 'static';
  const headerHidden = headerEnabled && !!session.scrollHidden && ['auto', 'auto-scroll'].includes(p.header.mode);
  // Vben showSidebar is independent of viewport, collapse and drawer visibility.
  const showSidebar = p.sidebar.enabled && !full && mode !== 'horizontal';
  const sidebarEnabled = desktop && showSidebar;
  const secondarySidebarEnabled = sidebarEnabled && two;
  const topNavigationEnabled =
    desktop && headerEnabled && ['horizontal', 'mixed-vertical', 'mixed-two-column'].includes(mode);
  const compactWidth = p.sidebar.collapsed ? foundationDimensions.collapsedWidth : p.sidebar.width;
  const expandedWidth =
    p.sidebar.collapsed && (session.sidebarExpanded || (p.sidebar.expandOnHover && session.hovered))
      ? p.sidebar.width
      : compactWidth;
  const tabbarEnabled = p.tabbar.enabled;
  const tabbarHidden = tabbarEnabled && !!session.scrollHidden && p.header.mode === 'auto-scroll' && headerEnabled;
  const headerOffset = headerEnabled && headerFixed && !headerHidden ? foundationDimensions.headerHeight : 0;
  return {
    mode,
    viewport,
    contentMaximized: !!session.contentMaximized,
    ...foundationDimensions,
    railWidth: foundationDimensions.secondaryRailWidth,
    sidebarWidth: p.sidebar.width,
    headerPlacement,
    headerEnabled,
    headerFixed,
    headerHidden,
    showSidebar,
    sidebarEnabled,
    secondarySidebarEnabled,
    topNavigationEnabled,
    primaryKind: !sidebarEnabled ? 'none' : two ? 'rail' : 'tree',
    primarySpace: !sidebarEnabled ? 0 : two ? foundationDimensions.secondaryRailWidth : compactWidth,
    primaryWidth: !sidebarEnabled ? 0 : two ? foundationDimensions.secondaryRailWidth : expandedWidth,
    secondarySpace: secondarySidebarEnabled ? compactWidth : 0,
    secondaryWidth: secondarySidebarEnabled ? expandedWidth : 0,
    sidebarOffset: headerPlacement === 'full' ? headerOffset : 0,
    sidebarFixed: p.sidebar.fixed,
    sidebarCollapsed: p.sidebar.collapsed,
    sidebarVisuallyCollapsed: p.sidebar.collapsed && expandedWidth === compactWidth,
    tabbarEnabled,
    tabbarFixed: headerFixed,
    tabbarHidden,
    tabbarOffset: headerOffset,
    contentMode: p.layout.contentMode,
    fixedWidth: p.layout.fixedWidth,
    contentPadding: p.layout.contentPadding,
    footerEnabled: p.footer.enabled,
    footerFixed: p.footer.fixed,
    recoveryRequired:
      !headerEnabled ||
      (!sidebarEnabled &&
        (desktop || headerHidden) &&
        !(mode === 'horizontal' && topNavigationEnabled && !headerHidden)),
    scrollHost: 'document' as const,
  } as const;
}
export type BusinessLayoutModel = ReturnType<typeof resolveBusinessLayout>;
