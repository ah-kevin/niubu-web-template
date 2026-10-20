import type { ComponentType } from 'react';
import type { DomainModule, RouteMeta } from '@niubu/types';
import { createModuleRegistry } from '@niubu/access';
import { systemModule } from './system';
import { LoginPage } from '../auth/Login';

const routes = [
  {
    id: 'starter.home',
    path: '/home',
    titleKey: 'app:home',
    iconToken: 'home',
    order: 0,
    navigation: true,
    scope: 'workspace',
    capability: null,
  },
  {
    id: 'starter.login',
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
    id: 'starter.profile',
    path: '/profile',
    titleKey: 'shell:user.profile',
    iconToken: 'home',
    order: 92,
    navigation: false,
    scope: 'account',
    capability: null,
  },
] as const satisfies readonly RouteMeta[];
const module: DomainModule<RouteMeta, ComponentType> = {
  id: 'starter.app',
  routes,
  menus: [{ pageId: 'starter.home' }],
  permissions: [],
  namespaces: ['app'],
  loaders: {
    '/home': async () => ({ Component: (await import('./home')).HomePage }),
    '/login': async () => ({ Component: LoginPage }),
    '/profile': async () => ({ Component: (await import('../app/ProfilePage')).ProfilePage }),
  },
};
export const registry = createModuleRegistry([module, systemModule]);
