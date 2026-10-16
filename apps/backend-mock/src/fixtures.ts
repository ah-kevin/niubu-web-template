import type { AuthUser, BackendMenuItem, ScopeRef } from '@niubu/types';

// Intentionally public, synthetic examples. Never use real credentials here.
export const MOCK_ONLY_SENTINEL = 'NIUBU_BACKEND_MOCK_ONLY_STAGE3';

export interface User extends AuthUser<'workspace'> {
  workspaces: readonly (ScopeRef<'workspace'> & { readonly name: string })[];
}

export const demoAccount = { username: 'demo@playground.invalid', password: 'demo-only' } as const;
export const secondAccount = { username: 'second@playground.invalid', password: 'demo-only' } as const;
export const demoUser = {
  id: 'demo-user',
  name: 'Demo User',
  roles: ['admin'],
  workspaces: [
    { kind: 'workspace', id: 'north', name: 'North' },
    { kind: 'workspace', id: 'south', name: 'South' },
  ],
} as const satisfies User;

export const secondUser = {
  id: 'second-user',
  name: 'Second User',
  roles: ['viewer'],
  workspaces: [
    { kind: 'workspace', id: 'north', name: 'North' },
    { kind: 'workspace', id: 'south', name: 'South' },
  ],
} as const satisfies User;

const home = { kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' } as const;
const profile = { kind: 'page', id: 'profile', pageId: 'playground.profile', hidden: true } as const;
export const publicMenu = [home] as const satisfies readonly BackendMenuItem[];
export const systemMenu = {
  kind: 'group',
  id: 'system',
  title: 'System',
  order: 15,
  children: ['users', 'roles', 'menus', 'departments'].map(resource => ({
    kind: 'page' as const,
    id: `system-${resource}`,
    pageId: `playground.system.${resource}`,
  })),
} as const satisfies BackendMenuItem;
export const systemReadCodes = [
  'system:users:read',
  'system:roles:read',
  'system:menus:read',
  'system:departments:read',
] as const;
export const systemWriteCodes = [
  'system:users:write',
  'system:roles:write',
  'system:menus:write',
  'system:departments:write',
] as const;
export const scopedFixtures = {
  north: {
    menu: [
      {
        kind: 'group',
        id: 'workspace-pages',
        title: 'Workspace',
        order: 10,
        children: [
          home,
          { kind: 'page', id: 'request', pageId: 'playground.request', icon: 'arrow-right-left', badge: 'Demo' },
        ],
      },
      systemMenu,
      {
        kind: 'external',
        id: 'documentation',
        title: 'Documentation',
        href: 'https://example.com/docs',
        icon: 'external-link',
        order: 20,
        openInNewWindow: true,
      },
      { kind: 'iframe', id: 'frame-demo', title: 'Embedded demo', src: '/frame-demo.html', icon: 'monitor', order: 30 },
      // Deliberately unknown: consumers must diagnose and skip this item only.
      { kind: 'page', id: 'unknown-demo', pageId: 'unknown.page', title: 'Unknown page demo', order: 40 },
      profile,
    ],
    codes: ['demo:read', 'demo:echo', 'demo:transfer', ...systemReadCodes, ...systemWriteCodes],
  },
  south: { menu: [...publicMenu, profile], codes: ['demo:read'] },
} as const satisfies Record<string, { menu: readonly BackendMenuItem[]; codes: readonly string[] }>;

const secondScopedFixtures = {
  north: {
    menu: [
      { kind: 'group', id: 'workspace-pages', title: 'Workspace', order: 10, children: [home] },
      systemMenu,
      profile,
    ],
    codes: ['demo:read', ...systemReadCodes],
  },
  south: { menu: [...publicMenu, profile], codes: ['demo:read'] },
} as const satisfies Record<string, { menu: readonly BackendMenuItem[]; codes: readonly string[] }>;

export const syntheticAccounts = [
  { ...demoAccount, user: demoUser, scopes: scopedFixtures },
  { ...secondAccount, user: secondUser, scopes: secondScopedFixtures },
] as const;
