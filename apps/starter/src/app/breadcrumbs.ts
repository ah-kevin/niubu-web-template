import type { AccessMenuNode, RouteMeta } from '@niubu/access';
import type { BreadcrumbItem } from '@niubu/layouts/widgets';
type Page = Extract<AccessMenuNode, { kind: 'page' }>;
function findPath(
  nodes: readonly AccessMenuNode[],
  pageId: string,
  pathname?: string,
): readonly AccessMenuNode[] | null {
  for (const node of nodes) {
    if (node.kind === 'page' && node.pageId === pageId) return [node];
    if (node.kind === 'iframe' && pathname === `/embedded/${encodeURIComponent(node.id)}`) return [node];
    if (node.kind === 'group') {
      const child = findPath(node.children, pageId, pathname);
      if (child) return [node, ...child];
    }
  }
  return null;
}
function pages(nodes: readonly AccessMenuNode[]): readonly Page[] {
  return nodes.flatMap(n => (n.kind === 'group' ? pages(n.children) : n.kind === 'page' ? [n] : []));
}
/**
 * Titles and ancestors come from the current authorized menu, not guessed route segments.
 * `currentLabel` is a literal, caller-owned title for a page outside the menu (such as a detail page).
 */
export function buildStarterBreadcrumbs(
  menu: readonly AccessMenuNode[],
  meta: RouteMeta | null,
  pathname: string,
  routes: readonly RouteMeta[],
  currentLabel?: string,
): readonly BreadcrumbItem[] {
  if (!meta) return [];
  const home = pages(menu).find(n => n.pageId === 'starter.home');
  let path = findPath(menu, meta.id, pathname);
  const direct = path !== null;
  if (!path) {
    const candidates = pages(menu)
      .map(node => ({ node, route: routes.find(r => r.id === node.pageId) }))
      .filter(
        (entry): entry is { node: Page; route: RouteMeta } =>
          !!entry.route && !entry.route.path.includes(':') && pathname.startsWith(entry.route.path + '/'),
      )
      .sort((a, b) => b.route.path.length - a.route.path.length);
    if (candidates[0]) path = findPath(menu, candidates[0].node.pageId);
  }
  const result: BreadcrumbItem[] = (path ?? []).map((node, index) => ({
    id: node.id,
    labelKey: node.title,
    current: direct && index === path!.length - 1,
    ...(node.kind === 'page' && !(direct && index === path!.length - 1) ? { href: node.href } : {}),
    iconToken: node.icon,
  }));
  if (!direct)
    result.push({
      id: meta.id,
      labelKey: meta.titleKey,
      ...(currentLabel ? { label: currentLabel } : {}),
      iconToken: meta.iconToken,
      current: true,
    });
  if (home && meta.id !== 'starter.home' && !result.some(r => r.id === home.id))
    result.unshift({
      id: home.id,
      labelKey: home.title,
      href: home.href,
      home: true,
      current: false,
      iconToken: home.icon,
    });
  return result;
}
