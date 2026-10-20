import type { ComponentType } from 'react';
import type { DomainModule, RouteMeta } from '@niubu/types';

const routes = [
  {
    id: 'starter.system.users',
    path: '/system/users',
    titleKey: 'app:system.users',
    iconToken: 'users',
    order: 10,
    navigation: true,
    scope: 'workspace',
    capability: null,
    requiredCodes: ['system:users:read'],
  },
  {
    id: 'starter.system.roles',
    path: '/system/roles',
    titleKey: 'app:system.roles',
    iconToken: 'shield-check',
    order: 11,
    navigation: true,
    scope: 'workspace',
    capability: null,
    requiredCodes: ['system:roles:read'],
  },
  {
    id: 'starter.system.menus',
    path: '/system/menus',
    titleKey: 'app:system.menus',
    iconToken: 'menu',
    order: 12,
    navigation: true,
    scope: 'workspace',
    capability: null,
    requiredCodes: ['system:menus:read'],
  },
  {
    id: 'starter.system.departments',
    path: '/system/departments',
    titleKey: 'app:system.departments',
    iconToken: 'building-2',
    order: 13,
    navigation: true,
    scope: 'workspace',
    capability: null,
    requiredCodes: ['system:departments:read'],
  },
] as const satisfies readonly RouteMeta[];
export const systemModule: DomainModule<RouteMeta, ComponentType> = {
  id: 'starter.system',
  routes,
  menus: routes.map(route => ({ pageId: route.id })),
  permissions: [],
  namespaces: ['app'],
  loaders: {
    '/system/users': async () => ({ Component: (await import('../system/UsersPage')).UsersPage }),
    '/system/roles': async () => ({ Component: (await import('../system/RolesPage')).RolesPage }),
    '/system/menus': async () => ({ Component: (await import('../system/MenusPage')).MenusPage }),
    '/system/departments': async () => ({ Component: (await import('../system/DepartmentsPage')).DepartmentsPage }),
  },
};
