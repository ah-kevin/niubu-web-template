import type { AccessMenuNode } from '@niubu/access';
import type { NavigationNode } from '@niubu/menu-ui';
import type { ScopeRef } from '@niubu/types';
import { withScope } from './scope';
import { icons } from '../icons';
export function projectMenu(
  nodes: readonly AccessMenuNode[],
  pathname: string,
  scope: ScopeRef | null,
  translate: (key: string) => string,
): readonly NavigationNode[] {
  return nodes.map(node => {
    const label = node.title.startsWith('app:') ? translate(node.title) : node.title;
    const Icon = icons.resolve(
      node.icon ?? (node.kind === 'external' ? 'external-link' : node.kind === 'iframe' ? 'monitor' : 'home'),
    );
    const common = {
      id: node.id,
      label,
      badge: node.badge,
      icon: Icon ? <Icon width={18} height={18} aria-hidden="true" /> : undefined,
    };
    if (node.kind === 'group')
      return {
        ...common,
        kind: 'branch' as const,
        presentation: 'group' as const,
        children: projectMenu(node.children, pathname, scope, translate),
      };
    const href = node.kind === 'iframe' ? `/embedded/${encodeURIComponent(node.id)}${withScope('', scope)}` : node.href;
    const active =
      node.kind === 'page'
        ? (node.activePath ?? new URL(href, 'https://playground.invalid').pathname) === pathname
        : node.kind === 'iframe' && pathname === `/embedded/${encodeURIComponent(node.id)}`;
    return {
      ...common,
      kind: 'leaf' as const,
      href,
      active,
      target: node.target,
      rel: node.rel,
      external: node.kind === 'external',
    };
  });
}
