import { expect, it } from 'vitest';
import type { AccessMenuNode, RouteMeta } from '@niubu/access';
import { buildStarterBreadcrumbs } from './breadcrumbs';

const menu = [
  { kind: 'page', id: 'home', pageId: 'starter.home', title: 'app:home', href: '/home' },
  { kind: 'page', id: 'users', pageId: 'starter.users', title: 'app:system.users', href: '/system/users' },
] as unknown as readonly AccessMenuNode[];
const routes = [
  { id: 'starter.home', path: '/home', titleKey: 'app:home' },
  { id: 'starter.users', path: '/system/users', titleKey: 'app:system.users' },
  { id: 'starter.user-detail', path: '/system/users/detail', titleKey: 'app:system.userDetail' },
] as unknown as readonly RouteMeta[];

it('labels a page outside the menu with the caller-owned title and leaves menu pages untouched', () => {
  const detail = buildStarterBreadcrumbs(menu, routes[2]!, '/system/users/detail', routes, 'Alice');
  expect(detail.at(-1)).toMatchObject({ id: 'starter.user-detail', label: 'Alice', current: true });
  expect(detail.map(item => item.id)).toEqual(['home', 'users', 'starter.user-detail']);
  const plain = buildStarterBreadcrumbs(menu, routes[2]!, '/system/users/detail', routes);
  expect(plain.at(-1)).not.toHaveProperty('label');
  const direct = buildStarterBreadcrumbs(menu, routes[1]!, '/system/users', routes, 'Alice');
  expect(direct.every(item => !('label' in item))).toBe(true);
});
