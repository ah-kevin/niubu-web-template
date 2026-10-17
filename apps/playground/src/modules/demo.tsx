import { systemModule } from './system';
import { examplesModule } from './examples';
import type { ComponentType } from 'react';
import { createModuleRegistry } from '@niubu/access';
import type { DomainModule, RouteMeta } from '@niubu/types';

const routes = [
  {
    id: 'playground.home',
    path: '/home',
    titleKey: 'app:home',
    iconToken: 'home',
    order: 0,
    navigation: true,
    scope: 'public',
    capability: null,
  },
  {
    id: 'playground.request',
    path: '/request',
    titleKey: 'app:request',
    iconToken: 'arrow-right-left',
    order: 1,
    navigation: true,
    scope: 'workspace',
    capability: null,
    requiredCodes: ['demo:read'],
  },
  {
    id: 'playground.login',
    path: '/login',
    titleKey: 'app:login',
    iconToken: 'home',
    order: 90,
    navigation: false,
    scope: 'public',
    capability: null,
    ignoreAccess: true,
  },
  {
    id: 'playground.profile',
    path: '/profile',
    titleKey: 'shell:user.profile',
    iconToken: 'home',
    order: 92,
    navigation: false,
    scope: 'account',
    capability: null,
  },
  {
    id: 'playground.embedded',
    path: '/embedded/:menuId',
    titleKey: 'app:embedded',
    iconToken: 'monitor',
    order: 91,
    navigation: false,
    scope: 'workspace',
    capability: null,
    requiredCodes: ['demo:read'],
  },
] as const satisfies readonly RouteMeta[];
const demo: DomainModule<RouteMeta, ComponentType> = {
  id: 'playground.demo',
  routes,
  menus: routes.filter(route => route.navigation).map(route => ({ pageId: route.id })),
  permissions: [],
  namespaces: ['app'],
  loaders: {
    '/home': async () => ({ Component: (await import('./home')).HomePage }),
    '/request': async () => ({ Component: (await import('./request')).RequestPage }),
    '/login': async () => ({ Component: (await import('../auth/Login')).LoginPage }),
    '/profile': async () => ({ Component: (await import('../app/ProfilePage')).ProfilePage }),
    '/embedded/:menuId': async () => ({ Component: (await import('../auth/Embedded')).EmbeddedPage }),
  },
};
export const registry = createModuleRegistry([demo, systemModule, examplesModule]);
/** Backend selects stable public ids; code exclusively owns paths, order and loaders. */
export function selectPublicMenu(pageIds: readonly string[]) {
  const selected = new Set(pageIds);
  return registry.routes.filter(route => route.scope === 'public' && route.navigation && selected.has(route.id));
}
