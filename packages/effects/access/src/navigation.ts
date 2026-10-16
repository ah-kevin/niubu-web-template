import type { RouteMeta, ScopeRef } from '@niubu/core-typings';

/** Pure projection shape, structurally usable by tree renderers. */
export type NavigationNode = Readonly<
  | { kind: 'branch'; id: string; label: string; presentation?: 'group'; children: readonly NavigationNode[] }
  | { kind: 'leaf'; id: string; label: string; href: string; active: boolean }
>;
export type NavigationRoute = RouteMeta &
  Readonly<{
    domain: string;
    groupKey: string;
    titleParams?: Readonly<{ titleKey: string }>;
  }>;
export type NavigationOptions = Readonly<{
  domainLabels: Readonly<Record<string, string>>;
  homePath: string;
}>;
export type BreadcrumbItem = Readonly<{
  id: string;
  labelKey: string;
  href?: string;
  iconToken?: string;
  current: boolean;
  home?: boolean;
  titleParams?: Readonly<{ titleKey: string }>;
}>;

/** Carry only the validated scope, never page-specific URL filters. */
export function navigationHref(route: Pick<RouteMeta, 'path'>, scope: ScopeRef | null): string {
  if (!scope) return route.path;
  return `${route.path}?${new URLSearchParams({ scopeKind: scope.kind, scopeId: scope.id })}`;
}
export function flattenNavigation(
  nodes: readonly NavigationNode[],
): readonly Extract<NavigationNode, { kind: 'leaf' }>[] {
  return nodes.flatMap(node => (node.kind === 'leaf' ? [node] : flattenNavigation(node.children)));
}
export function projectBusinessNavigation(
  routes: readonly NavigationRoute[],
  current: { pathname: string; search: string },
  scope: ScopeRef | null,
  options: NavigationOptions,
): readonly NavigationNode[] {
  const ordered = [...routes].filter(route => route.navigation).sort((a, b) => a.order - b.order);
  const owner = ordered
    .filter(route => current.pathname === route.path || current.pathname.startsWith(`${route.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return [...new Set(ordered.map(route => route.groupKey))].map(group => ({
    kind: 'branch',
    id: `group:${group}`,
    label: group,
    presentation: 'group',
    children: [...new Set(ordered.filter(route => route.groupKey === group).map(route => route.domain))].map(
      domain => ({
        kind: 'branch',
        id: `domain:${domain}`,
        label: options.domainLabels[domain] ?? domain,
        children: ordered
          .filter(route => route.groupKey === group && route.domain === domain)
          .map(route => ({
            kind: 'leaf',
            id: route.id,
            label: route.titleKey,
            href: navigationHref(route, scope),
            active: owner?.id === route.id,
          })),
      }),
    ),
  }));
}
const isStaticPath = (path: string): boolean =>
  !path.split('/').some(segment => segment.includes(':') || segment.includes('*'));
/** Ancestor links must be visible concrete paths. */
export function projectBreadcrumbs(
  current: NavigationRoute,
  scope: ScopeRef | null,
  visible: readonly NavigationRoute[],
  options: NavigationOptions,
): readonly BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  const home = visible.find(route => route.path === options.homePath && isStaticPath(route.path));
  const isHome = current.path === options.homePath;
  if (home && !isHome)
    items.push({
      id: 'home',
      labelKey: home.titleKey,
      href: navigationHref(home, scope),
      iconToken: home.iconToken,
      current: false,
      home: true,
    });
  if (!isHome)
    items.push({
      id: `domain:${current.domain}`,
      labelKey: options.domainLabels[current.domain] ?? current.groupKey,
      iconToken: current.iconToken,
      current: false,
    });
  const parent = visible
    .filter(
      route =>
        route.domain === current.domain &&
        route.path !== current.path &&
        isStaticPath(route.path) &&
        current.path.startsWith(`${route.path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (parent)
    items.push({
      id: parent.id,
      labelKey: parent.titleKey,
      href: navigationHref(parent, scope),
      iconToken: parent.iconToken,
      current: false,
    });
  items.push({
    id: current.id,
    labelKey: current.titleKey,
    titleParams: current.titleParams,
    iconToken: current.iconToken,
    current: true,
  });
  return items;
}
