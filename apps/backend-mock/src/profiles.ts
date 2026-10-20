import type { MockConfig } from './config';
import { defaultMockConfig, systemReadCodes, systemWriteCodes } from './fixtures';
import { createWorkspaceSeed } from './system/fixtures';

/** Product-only fixtures; never import a frontend app or derive grants from CRUD records. */
export function createStarterMockConfig(): MockConfig {
  const pageIds = [
    'starter.home',
    ...['users', 'roles', 'menus', 'departments'].map(resource => `starter.system.${resource}`),
  ];
  const menu = [
    { kind: 'page' as const, id: 'home', pageId: 'starter.home', icon: 'home' },
    {
      kind: 'group' as const,
      id: 'system',
      title: 'app:navigation.system',
      icon: 'settings',
      children: pageIds.slice(1).map(pageId => ({ kind: 'page' as const, id: pageId, pageId })),
    },
    { kind: 'page' as const, id: 'profile', pageId: 'starter.profile', hidden: true },
  ];
  const seed = createWorkspaceSeed('north');
  seed.menus = [
    { id: 'menu-north-system', title: 'System', kind: 'group', parentId: null, order: 0, enabled: true },
    ...pageIds.map((pageId, index) => ({
      id: `menu-north-page-${index}`,
      title: pageId,
      kind: 'page' as const,
      pageId,
      parentId: 'menu-north-system',
      order: index,
      enabled: true,
    })),
  ];
  return {
    accounts: ['admin', 'viewer'].map(role => ({
      username: `${role}@starter.invalid`,
      password: 'demo-only',
      user: {
        id: `starter-${role}`,
        name: role === 'admin' ? 'Administrator' : 'Read-only user',
        roles: [role],
        workspaces: [{ kind: 'workspace' as const, id: 'north', name: 'Default workspace' }],
      },
      scopes: { north: { menu, codes: [...systemReadCodes, ...(role === 'admin' ? systemWriteCodes : [])] } },
    })),
    publicMenu: [],
    navigablePageIds: pageIds,
    systemSeeds: { north: seed, south: { users: [], roles: [], menus: [], departments: [] } },
  };
}

export function selectMockConfig(profile: string | undefined): MockConfig {
  if (profile === undefined || profile === 'playground') return defaultMockConfig;
  if (profile === 'starter') return createStarterMockConfig();
  throw new Error('Unknown mock profile');
}
