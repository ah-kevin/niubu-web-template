import { useEffect, useState } from 'react';
import { BusinessLayout, type AppLayoutProps } from '@niubu/layout-ui';
import { resolveBusinessLayout } from '@niubu/layout-ui/model';
import type { NavigationNode } from '@niubu/menu-ui';
import { normalizeMenuOrder, toggleMenuBranch } from '@niubu/menu-ui/ordering';
import { usePreferenceManager, usePreferenceSnapshot } from '@niubu/preferences';
import { useTranslation } from '@niubu/locales/react';
import { useAppStores, useAppStoreSnapshot } from '@niubu/stores/react';
export type BusinessShellProps = Omit<
  AppLayoutProps,
  | 'density'
  | 'headerMenuAlign'
  | 'model'
  | 'labels'
  | 'mobileOpen'
  | 'onMobileOpenChange'
  | 'expandedIds'
  | 'order'
  | 'onExpand'
  | 'onReorder'
  | 'primaryNodes'
  | 'secondaryNodes'
  | 'topNodes'
  | 'selectedPrimaryId'
  | 'selectedTopId'
  | 'onSelectPrimary'
  | 'onSelectTop'
  | 'onSidebarInteractionChange'
  | 'sidebarControls'
  | 'onSidebarTemporaryExpansionChange'
  | 'showCollapsedTitle'
  | 'menuStyle'
  | 'onRestoreLayout'
> & {
  navigationKey?: string;
  onNavigateTo?: (href: string) => void;
  contentMaximized?: boolean;
  onRestoreContent?: () => void;
};
const active = (node: NavigationNode): boolean => (node.kind === 'leaf' ? node.active : node.children.some(active));
const activeBranches = (nodes: readonly NavigationNode[]): string[] =>
  nodes.flatMap(node =>
    node.kind === 'branch'
      ? [...(active(node) && node.presentation !== 'group' ? [node.id] : []), ...activeBranches(node.children)]
      : [],
  );
const firstLeaf = (node: NavigationNode): string | undefined =>
  node.kind === 'leaf' ? node.href : node.children.map(firstLeaf).find(Boolean);
function useViewport() {
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 900px)').matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 900px)');
    const change = () => setMobile(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return mobile ? ('mobile' as const) : ('desktop' as const);
}
export function BusinessShell(props: BusinessShellProps) {
  // Route invalidation clears ephemeral navigation state, never persisted display intent.
  return <BusinessSession {...props} />;
}
function BusinessSession(props: BusinessShellProps) {
  const { core } = usePreferenceSnapshot();
  const manager = usePreferenceManager();
  const { t } = useTranslation('shell');
  const stores = useAppStores();
  const { ui } = useAppStoreSnapshot();
  const viewport = useViewport();
  const [interactions, setInteractions] = useState<Readonly<Record<string, boolean>>>({});
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [expandedIds, setExpandedIds] = useState<readonly string[]>(() => activeBranches(props.navigation));
  const [order, setOrder] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>();
  const [selectedDomain, setSelectedDomain] = useState<string>();
  const [previous, setPrevious] = useState({
    navigationKey: props.navigationKey,
    mode: core.layout.mode,
    headerMode: core.header.mode,
  });
  if (
    previous.navigationKey !== props.navigationKey ||
    previous.mode !== core.layout.mode ||
    previous.headerMode !== core.header.mode
  ) {
    setPrevious({ navigationKey: props.navigationKey, mode: core.layout.mode, headerMode: core.header.mode });
    setInteractions({});
    if (previous.navigationKey !== props.navigationKey || previous.mode !== core.layout.mode) setSidebarExpanded(false);
    setScrollHidden(false);
    if (previous.navigationKey !== props.navigationKey) {
      setExpandedIds(activeBranches(props.navigation));
      setSelectedGroup(undefined);
      setSelectedDomain(undefined);
    }
  }
  useEffect(() => {
    if (!['auto', 'auto-scroll'].includes(core.header.mode)) return;
    let previous = window.scrollY;
    const scroll = () => {
      const current = window.scrollY;
      setScrollHidden(current > 0 && current > previous && !document.activeElement?.closest('.workspace-header'));
      previous = current;
    };
    window.addEventListener('scroll', scroll, { passive: true });
    return () => window.removeEventListener('scroll', scroll);
  }, [core.header.mode]);
  const parents: Record<string, string | null> = {};
  const sort = (nodes: readonly NavigationNode[], parent: string | null = null): readonly NavigationNode[] =>
    normalizeMenuOrder(
      nodes.map(n => n.id),
      order[parent ?? '$root'],
    ).map(id => {
      const node = nodes.find(n => n.id === id)!;
      parents[id] = parent;
      return node.kind === 'branch' ? { ...node, children: sort(node.children, id) } : node;
    });
  const nodes = sort(props.navigation);
  const groups = nodes.filter(n => n.kind === 'branch');
  const group = groups.find(n => n.id === selectedGroup) ?? groups.find(active) ?? groups[0];
  const mixed = core.layout.mode === 'mixed-vertical' || core.layout.mode === 'mixed-two-column';
  const domains =
    mixed && group?.kind === 'branch' ? group.children : groups.flatMap(n => (n.kind === 'branch' ? n.children : []));
  const domain = domains.find(n => n.id === selectedDomain) ?? domains.find(active) ?? domains[0];
  const activate = (node: NavigationNode | undefined) => {
    const href = node && firstLeaf(node);
    if (core.sidebar.autoActivateChild && href) props.onNavigateTo?.(href);
  };
  const model = resolveBusinessLayout(core, viewport, {
    hovered: Object.values(interactions).some(Boolean),
    sidebarExpanded,
    contentMaximized: props.contentMaximized,
    scrollHidden,
  });
  return (
    <BusinessLayout
      {...props}
      density={core.density}
      headerMenuAlign={core.header.menuAlign}
      model={model}
      navigation={nodes}
      primaryNodes={model.primaryKind === 'rail' ? domains : mixed && group?.kind === 'branch' ? group.children : nodes}
      secondaryNodes={domain?.kind === 'branch' ? domain.children : []}
      topNodes={
        core.layout.mode === 'horizontal'
          ? groups.map(node => (node.kind === 'branch' ? { ...node, presentation: undefined } : node))
          : groups
      }
      selectedPrimaryId={domain?.id}
      selectedTopId={group?.id}
      onSelectPrimary={id => {
        setSelectedDomain(id);
        activate(domains.find(n => n.id === id));
      }}
      onSelectTop={id => {
        setSelectedGroup(id);
        setSelectedDomain(undefined);
        activate(groups.find(n => n.id === id));
      }}
      expandedIds={expandedIds}
      order={order}
      onExpand={(id, open) => {
        setExpandedIds(ids => toggleMenuBranch(ids, id, open, parents, core.menu.accordion));
      }}
      onReorder={(parent, ids) => setOrder(previous => ({ ...previous, [parent]: ids }))}
      onSidebarInteractionChange={(region, input, active) =>
        setInteractions(previous => ({ ...previous, [`${region}:${input}`]: active }))
      }
      onSidebarTemporaryExpansionChange={expanded => {
        setSidebarExpanded(expanded);
        if (!expanded) setInteractions({});
      }}
      showCollapsedTitle={core.sidebar.collapsedShowTitle}
      menuStyle={core.menu.style}
      sidebarControls={{
        width: core.sidebar.width,
        collapsed: core.sidebar.collapsed,
        fixed: core.sidebar.fixed,
        draggable: core.sidebar.draggable,
        showCollapse: core.sidebar.showCollapseButton,
        showFixed: core.sidebar.showFixedButton,
        onWidthChange: width => manager.update({ sidebar: { width } }),
        onCollapsedChange: collapsed => manager.update({ sidebar: { collapsed } }),
        onFixedChange: fixed => manager.update({ sidebar: { fixed } }),
      }}
      onRestoreLayout={() => {
        if (model.contentMaximized) props.onRestoreContent?.();
        else manager.update({ layout: { mode: 'vertical' }, header: { enabled: true }, sidebar: { enabled: true } });
      }}
      mobileOpen={ui.mobileOpen}
      onMobileOpenChange={mobileOpen => stores.ui.update({ mobileOpen })}
      labels={{
        close: t('common:close'),
        skipContent: t('skipContent'),
        sidebar: t('sidebar'),
        navigation: t('navigation'),
        mobileNavigation: t('mobileNavigation'),
        openNavigation: t('openNavigation'),
        workspaceNavigation: t('workspaceNavigation'),
        pageContext: t('pageContext'),
        recovery: t('layoutRecovery'),
        restoreLayout: t('restoreLayout'),
        collapse: t('collapseSidebar'),
        expand: t('expandSidebar'),
        pin: t('pinSidebar'),
        unpin: t('unpinSidebar'),
        resize: t('resizeSidebar'),
        secondaryNavigation: t('secondaryNavigation'),
        topNavigation: t('topNavigation'),
      }}
    />
  );
}
