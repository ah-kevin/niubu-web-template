import { describe, expect, it } from 'vitest';
import { createMockBackend } from './dispatcher';
import { readJsonBody } from './test-response';
import { createStarterMockConfig, selectMockConfig } from './profiles';

describe('independent admin starter profile', () => {
  it('keeps the default playground and rejects unknown profile names', () => {
    expect(selectMockConfig(undefined).accounts[0]?.username).toBe('demo@playground.invalid');
    expect(() => selectMockConfig('unknown/profile')).toThrow('Unknown mock profile');
    expect(createStarterMockConfig().publicMenu).toEqual([]);
  });

  it('owns its account, menu, single workspace and read/write policy', async () => {
    const config = createStarterMockConfig();
    const backend = createMockBackend({ config });
    try {
      for (const [username, writable] of [['admin', true], ['viewer', false]] as const) {
        const login = readJsonBody(await backend.dispatch({ method: 'POST', path: '/api/auth/login', body: { username, password: username } }));
        expect(login.code).toBe(0);
        const headers = { Authorization: `Bearer ${(login.data as { accessToken: string }).accessToken}` };
        const query = { scopeKind: 'workspace', scopeId: 'north' };
        const user = readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/user', headers })).data as { workspaces: { id: string }[] };
        expect(user.workspaces.map(scope => scope.id)).toEqual(['north']);
        const menu = JSON.stringify(readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/menu', headers, query })).data);
        expect(menu).toContain('starter.system.departments');
        expect(menu).not.toContain('playground');
        const before = readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/auth/codes', headers, query })).data;
        const create = await backend.dispatch({ method: 'POST', path: '/api/system/roles', headers, query, body: { name: 'New role', code: `new-${writable}`, description: '', enabled: true } });
        expect(create.status).toBe(writable ? 200 : 403);
        expect(readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/auth/codes', headers, query })).data).toEqual(before);
        expect((await backend.dispatch({ method: 'GET', path: '/api/system/users', headers, query: { scopeKind: 'workspace', scopeId: 'south' } })).status).toBe(403);
      }
      expect(config.navigablePageIds).toEqual(['starter.home', 'starter.system.users', 'starter.system.roles', 'starter.system.menus', 'starter.system.departments']);
      expect(config.accounts.map(account => account.user.id)).toEqual(['starter-admin', 'starter-viewer']);
      expect(JSON.stringify(config.systemSeeds)).not.toContain('playground');
    } finally { backend.dispose(); }
  });

  it('creates fresh resource instances and never turns resource users into login accounts', async () => {
    const config = createStarterMockConfig();
    const backend = createMockBackend({ config });
    try {
      const login = readJsonBody(await backend.dispatch({ method: 'POST', path: '/api/auth/login', body: { username: 'admin', password: 'admin' } }));
      const headers = { Authorization: `Bearer ${(login.data as { accessToken: string }).accessToken}` };
      const query = { scopeKind: 'workspace', scopeId: 'north' };
      const seed = config.systemSeeds.north;
      const response = await backend.dispatch({ method: 'POST', path: '/api/system/users', headers, query, body: { name: 'Synthetic', email: 'resource@starter.invalid', roleId: seed.roles[0]!.id, departmentId: seed.departments[0]!.id, enabled: true } });
      expect(response.status).toBe(200);
      expect((await backend.dispatch({ method: 'POST', path: '/api/auth/login', body: { username: 'resource@starter.invalid', password: 'demo-only' } })).status).toBe(401);
      expect(createStarterMockConfig().systemSeeds.north.users).toHaveLength(seed.users.length);
    } finally { backend.dispose(); }
  });
});
