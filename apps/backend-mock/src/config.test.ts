import { describe, expect, it } from 'vitest';
import { createMockBackend } from './dispatcher';
import type { MockConfig, MockEndpoint } from './config';
import { readJsonBody } from './test-response';

function customConfig(): MockConfig {
  return {
    accounts: [{
      username: 'custom@mock.invalid', password: 'custom-only',
      user: { id: 'custom-user', name: 'Custom', roles: ['operator'], workspaces: [{ kind: 'workspace', id: 'north', name: 'Custom North' }] },
      scopes: { north: { menu: [{ kind: 'page', id: 'custom', pageId: 'custom.home' }], codes: ['system:menus:read', 'system:menus:write', 'system:roles:read', 'system:roles:write', 'demo:transfer', 'custom:write'] } },
    }],
    publicMenu: [{ kind: 'page', id: 'public', pageId: 'custom.public' }],
    navigablePageIds: ['custom.home', 'custom.public'],
    systemSeeds: {
      north: { users: [], departments: [], menus: [], roles: [{ id: 'custom-role', name: 'Custom Role', code: 'custom-role', description: '', enabled: true }] },
      south: { users: [], departments: [], menus: [], roles: [] },
    },
  };
}
const query = { scopeKind: 'workspace', scopeId: 'north' };
async function login(backend: ReturnType<typeof createMockBackend>) {
  const response = await backend.dispatch({ method: 'POST', path: '/api/auth/login', body: { username: 'custom@mock.invalid', password: 'custom-only' } });
  expect(response.status).toBe(200);
  return readJsonBody(response).data as { accessToken: string; refreshToken: string };
}
const headers = (token: string) => ({ authorization: `Bearer ${token}` });
const menuInput = (pageId: string) => ({ title: 'Custom page', kind: 'page', parentId: null, order: 0, enabled: true, pageId });

describe('replaceable mock configuration', () => {
  it('replaces public/default identities, menus, codes and resource seeds without merging defaults', async () => {
    const backend = createMockBackend({ config: customConfig() });
    expect(readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/menu' })).data).toEqual([{ kind: 'page', id: 'public', pageId: 'custom.public' }]);
    expect((await backend.dispatch({ method: 'POST', path: '/api/auth/login', body: { username: 'demo@playground.invalid', password: 'demo-only' } })).status).toBe(401);
    const tokens = await login(backend);
    const auth = headers(tokens.accessToken);
    expect(readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/user', headers: auth })).data).toMatchObject({ id: 'custom-user', name: 'Custom' });
    expect(readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/menu', headers: auth, query })).data).toEqual([{ kind: 'page', id: 'custom', pageId: 'custom.home' }]);
    expect(readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/auth/codes', headers: auth, query })).data).toEqual(['system:menus:read', 'system:menus:write', 'system:roles:read', 'system:roles:write', 'demo:transfer', 'custom:write']);
    expect(readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/system/roles', headers: auth, query })).data).toEqual({ rowCount: 1, rows: [{ id: 'custom-role', name: 'Custom Role', code: 'custom-role', description: '', enabled: true }] });
    expect(readJsonBody(await backend.dispatch({ method: 'GET', path: '/api/system/menus', headers: auth, query })).data).toEqual({ rowCount: 0, rows: [] });
    expect((await backend.dispatch({ method: 'GET', path: '/api/menu', headers: auth, query: { ...query, scopeId: 'south' } })).status).toBe(403);
  });
  it('uses only the replacement page registry for CRUD creates and updates', async () => {
    const backend = createMockBackend({ config: customConfig() });
    const auth = headers((await login(backend)).accessToken);
    const create = (pageId: string) => backend.dispatch({ method: 'POST', path: '/api/system/menus', headers: auth, query, body: menuInput(pageId) });
    const created = await create('custom.home');
    expect(created.status).toBe(200);
    const { id } = readJsonBody(created).data as { id: string };
    expect((await create('playground.home')).status).toBe(400);
    expect((await backend.dispatch({ method: 'PUT', path: `/api/system/menus/${id}`, headers: auth, query, body: menuInput('custom.public') })).status).toBe(200);
    expect((await backend.dispatch({ method: 'PUT', path: `/api/system/menus/${id}`, headers: auth, query, body: menuInput('playground.home') })).status).toBe(400);
  });
  it('copies supplied config and results and isolates resources, tokens and disposal per instance', async () => {
    const config = customConfig();
    const a = createMockBackend({ config });
    const b = createMockBackend({ config });
    // Mutating the caller-owned data after construction cannot change either instance.
    Object.assign(config.accounts[0].user, { name: 'Changed' });
    Object.assign(config.systemSeeds.north.roles[0], { name: 'Changed' });
    const token = await login(a);
    const auth = headers(token.accessToken);
    const first = readJsonBody(await a.dispatch({ method: 'GET', path: '/api/user', headers: auth })).data;
    Object.assign(first as object, { name: 'Response changed' });
    expect(readJsonBody(await a.dispatch({ method: 'GET', path: '/api/user', headers: auth })).data).toMatchObject({ name: 'Custom' });
    expect((await b.dispatch({ method: 'GET', path: '/api/user', headers: auth })).status).toBe(401);
    expect((await a.dispatch({ method: 'DELETE', path: '/api/system/roles/custom-role', headers: auth, query })).status).toBe(200);
    const bAuth = headers((await login(b)).accessToken);
    expect(readJsonBody(await b.dispatch({ method: 'GET', path: '/api/system/roles', headers: bAuth, query })).data).toMatchObject({ rowCount: 1, rows: [{ name: 'Custom Role' }] });
    a.dispose();
    expect((await a.dispatch({ method: 'GET', path: '/api/health' })).status).toBe(503);
    expect((await b.dispatch({ method: 'GET', path: '/api/health' })).status).toBe(200);
  });
  it('preserves refresh/logout and transfer scope protections for custom identities', async () => {
    let time = 0;
    const backend = createMockBackend({ config: customConfig(), now: () => time });
    const token = await login(backend);
    time = 300_000;
    expect(await backend.dispatch({ method: 'GET', path: '/api/user', headers: headers(token.accessToken) })).toMatchObject({ status: 401, body: { code: 'ACCESS_EXPIRED' } });
    const refreshed = await backend.dispatch({ method: 'POST', path: '/api/auth/refresh', body: { refreshToken: token.refreshToken } });
    expect(refreshed.status).toBe(200);
    const next = readJsonBody(refreshed).data as typeof token;
    const begin = (scopeId: string) => backend.dispatch({ method: 'POST', path: '/api/transfers', headers: headers(next.accessToken), query: { ...query, scopeId }, body: { name: 'test.txt', size: 1, contentType: 'text/plain' } });
    expect((await begin('north')).status).toBe(200);
    expect((await begin('south')).status).toBe(403);
    expect((await backend.dispatch({ method: 'POST', path: '/api/auth/logout', body: { refreshToken: token.refreshToken } })).status).toBe(200);
    expect((await begin('north')).status).toBe(401);
  });
  it('rejects an explicitly null config instead of reactivating Playground defaults', () => {
    expect(() => createMockBackend({ config: null as unknown as MockConfig })).toThrow(/Invalid mock config/);
  });
  it.each([
    ['duplicate username', (c: MockConfig) => ({ ...c, accounts: [...c.accounts, { ...c.accounts[0], user: { ...c.accounts[0].user, id: 'other' } }] })],
    ['duplicate identity', (c: MockConfig) => ({ ...c, accounts: [...c.accounts, { ...c.accounts[0], username: 'other' }] })],
    ['missing grants', (c: MockConfig) => ({ ...c, accounts: [{ ...c.accounts[0], scopes: {} }] })],
    ['unknown workspace', (c: MockConfig) => ({ ...c, accounts: [{ ...c.accounts[0], user: { ...c.accounts[0].user, workspaces: [{ kind: 'workspace', id: 'other', name: 'Other' }] } }] })],
    ['duplicate pages', (c: MockConfig) => ({ ...c, navigablePageIds: ['custom.home', 'custom.home'] })],
    ['duplicate seed id', (c: MockConfig) => ({ ...c, systemSeeds: { ...c.systemSeeds, north: { ...c.systemSeeds.north, roles: [c.systemSeeds.north.roles[0], c.systemSeeds.north.roles[0]] } } })],
    ['bad seed relation', (c: MockConfig) => ({ ...c, systemSeeds: { ...c.systemSeeds, north: { ...c.systemSeeds.north, departments: [{ id: 'child', name: 'Child', code: 'child', parentId: 'missing', enabled: true }] } } })],
    ['old seed page', (c: MockConfig) => ({ ...c, systemSeeds: { ...c.systemSeeds, north: { ...c.systemSeeds.north, menus: [{ id: 'old', ...menuInput('playground.home') }] } } })],
    ['bad menu shape', (c: MockConfig) => ({ ...c, publicMenu: [{ kind: 'page', id: 'bad' }] })],
    ['duplicate menu id', (c: MockConfig) => ({ ...c, publicMenu: [c.publicMenu[0], c.publicMenu[0]] })],
  ])('rejects invalid configuration clearly: %s', (_name, change) => {
    expect(() => createMockBackend({ config: change(customConfig()) as MockConfig })).toThrow(/Invalid mock config/);
  });
});

function withEndpoint(endpoint: Partial<MockEndpoint> = {}): MockConfig {
  return { ...customConfig(), endpoints: [{ path: '/api/custom', methods: ['POST'], access: 'public', handler: ({ body, query, method }) => ({ body, values: query.getAll('tag'), method }), ...endpoint }] };
}
describe('explicit custom API extensions', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('shares parsing, envelopes and method rules for %s', async method => {
    const backend = createMockBackend({ config: withEndpoint({ methods: [method as 'POST'] }) });
    const request = { method, path: '/api/custom', body: '{"value":"custom"}', query: { tag: ['a', 'b'] } };
    expect(await backend.dispatch(request)).toMatchObject({ status: 200, headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' }, body: { code: 0, data: { body: { value: 'custom' }, values: ['a', 'b'], method }, message: 'OK' } });
    expect((await backend.dispatch({ ...request, method: 'GET' })).status).toBe(405);
    expect((await backend.dispatch({ ...request, body: '{' })).status).toBe(400);
    expect((await backend.dispatch({ ...request, body: '[]' })).status).toBe(400);
    expect((await backend.dispatch({ ...request, body: { value: 'a'.repeat(65_536) } })).status).toBe(413);
  });
  it('enforces authenticated and workspace/code access before calling handlers', async () => {
    const backend = createMockBackend({ config: withEndpoint({ methods: ['GET'], access: 'workspace', requiredCodes: ['custom:write'], handler: ({ user, scope }) => ({ user, scope }) }) });
    expect((await backend.dispatch({ method: 'GET', path: '/api/custom', query })).status).toBe(401);
    const auth = headers((await login(backend)).accessToken);
    expect((await backend.dispatch({ method: 'GET', path: '/api/custom', headers: auth })).status).toBe(403);
    expect((await backend.dispatch({ method: 'GET', path: '/api/custom', headers: auth, query: { ...query, scopeId: 'south' } })).status).toBe(403);
    expect((await backend.dispatch({ method: 'GET', path: '/api/custom', headers: auth, query: { scopeKind: 'workspace', scopeId: ['north', 'north'] } })).status).toBe(403);
    expect(await backend.dispatch({ method: 'GET', path: '/api/custom', headers: auth, query })).toMatchObject({ status: 200, body: { data: { user: { id: 'custom-user' }, scope: { kind: 'workspace', id: 'north' } } } });
    const denied = createMockBackend({ config: withEndpoint({ methods: ['GET'], access: 'workspace', requiredCodes: ['missing:code'] }) });
    expect((await denied.dispatch({ method: 'GET', path: '/api/custom', query, headers: headers((await login(denied)).accessToken) })).status).toBe(403);
    const protectedBackend = createMockBackend({ config: withEndpoint({ methods: ['GET'], access: 'authenticated', handler: ({ user }) => { Object.assign(user!, { name: 'Changed by handler' }); return user; } }) });
    expect((await protectedBackend.dispatch({ method: 'GET', path: '/api/custom' })).status).toBe(401);
    const protectedHeaders = headers((await login(protectedBackend)).accessToken);
    expect((await protectedBackend.dispatch({ method: 'GET', path: '/api/custom', headers: protectedHeaders })).status).toBe(200);
    expect(readJsonBody(await protectedBackend.dispatch({ method: 'GET', path: '/api/user', headers: protectedHeaders })).data).toMatchObject({ name: 'Custom' });
  });
  it('closes pending async responses and hides handler failures', async () => {
    let finish!: (value: unknown) => void;
    const backend = createMockBackend({ config: withEndpoint({ methods: ['GET'], handler: () => new Promise(resolve => { finish = resolve; }) }) });
    const pending = backend.dispatch({ method: 'GET', path: '/api/custom' });
    expect(finish).toBeTypeOf('function');
    backend.dispose();
    finish({ late: true });
    expect(await pending).toMatchObject({ status: 503, body: { code: 'DISPOSED', data: null } });
    expect((await backend.dispatch({ method: 'GET', path: '/api/custom' })).status).toBe(503);
    const throwing = createMockBackend({ config: withEndpoint({ methods: ['GET'], handler: () => { throw new Error('private handler detail'); } }) });
    expect(await throwing.dispatch({ method: 'GET', path: '/api/custom' })).toMatchObject({ status: 500, body: { code: 'INTERNAL_ERROR', data: null, message: 'Mock request failed' } });
  });
  it.each(['expired', 'logout'])('rejects a protected async result after session %s', async mode => {
    let time = 0;
    let finish!: (value: unknown) => void;
    const backend = createMockBackend({ now: () => time, config: withEndpoint({ methods: ['GET'], access: 'authenticated', handler: () => new Promise(resolve => { finish = resolve; }) }) });
    const token = await login(backend);
    const pending = backend.dispatch({ method: 'GET', path: '/api/custom', headers: headers(token.accessToken) });
    expect(finish).toBeTypeOf('function');
    if (mode === 'expired') time = 300_000;
    else await backend.dispatch({ method: 'POST', path: '/api/auth/logout', body: { refreshToken: token.refreshToken } });
    finish({ private: 'late' });
    expect(await pending).toMatchObject({ status: 401, body: { code: mode === 'expired' ? 'ACCESS_EXPIRED' : 'UNAUTHENTICATED', data: null } });
  });
  it('keeps an explicit data field for an empty handler result on the JSON wire', async () => {
    const backend = createMockBackend({ config: withEndpoint({ methods: ['GET'], handler: () => undefined }) });
    const result = await backend.dispatch({ method: 'GET', path: '/api/custom' });
    expect(JSON.parse(JSON.stringify(readJsonBody(result)))).toEqual({ code: 0, data: null, message: 'OK' });
  });
  it.each([1n, (() => { const circular: Record<string, unknown> = {}; circular.self = circular; return circular; })()])('turns a non-serializable handler result into an error envelope %#', async value => {
    const backend = createMockBackend({ config: withEndpoint({ methods: ['GET'], handler: () => value }) });
    const result = await backend.dispatch({ method: 'GET', path: '/api/custom' });
    expect(result).toMatchObject({ status: 500, body: { code: 'INTERNAL_ERROR', data: null } });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
  it.each(['/api/health', '/api/demo/echo', '/api/auth/login', '/api/auth/custom', '/api/menu', '/api/user', '/api/system/roles', '/api/transfers', '/api/transfers/x/download'])('rejects builtin route overrides: %s', path => {
    expect(() => createMockBackend({ config: withEndpoint({ path }) })).toThrow(/Invalid mock config/);
  });
  it.each([
    { methods: [] }, { methods: ['GET', 'GET'] }, { methods: ['TRACE'] }, { access: 'unknown' }, { path: '/api/custom?x=1' }, { path: '/api/../health' }, { access: 'public', requiredCodes: ['custom:write'] }, { handler: null },
  ])('rejects invalid extension configuration %#', endpoint => {
    expect(() => createMockBackend({ config: withEndpoint(endpoint as Partial<MockEndpoint>) })).toThrow(/Invalid mock config/);
  });
  it('rejects duplicate endpoint paths even for disjoint methods', () => {
    const config = withEndpoint();
    expect(() => createMockBackend({ config: { ...config, endpoints: [...config.endpoints!, { ...config.endpoints![0], methods: ['GET'] }] } })).toThrow(/Invalid mock config/);
  });
});


describe('review regressions: seed wire projection', () => {
  it.each([
    {
      kind: 'group' as const,
      source: { kind: 'group' as const, pageId: 'custom.home', href: 'https://stale.invalid/', openInNewWindow: true },
      expected: { kind: 'group' },
    },
    {
      kind: 'page' as const,
      source: { kind: 'page' as const, pageId: 'custom.home', href: 'https://stale.invalid/', openInNewWindow: true },
      expected: { kind: 'page', pageId: 'custom.home' },
    },
    {
      kind: 'external' as const,
      source: { kind: 'external' as const, pageId: 'custom.home', href: 'https://docs.invalid/', openInNewWindow: true },
      expected: { kind: 'external', href: 'https://docs.invalid/', openInNewWindow: true },
    },
  ])('normalizes seeded $kind rows to the same wire DTO as CRUD writes', async ({ source, expected }) => {
    const config = customConfig();
    const common = { title: 'Seed Menu', parentId: null, order: 0, enabled: true };
    const input = { ...common, ...source };
    const backend = createMockBackend({ config: { ...config, systemSeeds: { ...config.systemSeeds, north: { ...config.systemSeeds.north, menus: [{ ...input, id: 'seed-menu' }] } } } });
    try {
      const auth = headers((await login(backend)).accessToken);
      const expectedRow = { ...common, ...expected, id: 'seed-menu' };
      const list = await backend.dispatch({ method: 'GET', path: '/api/system/menus', headers: auth, query });
      expect(list.status).toBe(200);
      expect(readJsonBody(list).code).toBe(0);
      // Check the actual serialized list envelope; stale variant keys must not cross the wire.
      expect(JSON.parse(JSON.stringify(readJsonBody(list))).data).toEqual({ rows: [expectedRow], rowCount: 1 });
      const detail = await backend.dispatch({ method: 'GET', path: '/api/system/menus/seed-menu', headers: auth, query });
      expect(detail.status).toBe(200);
      expect(readJsonBody(detail).data).toEqual(expectedRow);
      const created = await backend.dispatch({ method: 'POST', path: '/api/system/menus', headers: auth, query, body: input });
      expect(created.status).toBe(200);
      expect(readJsonBody(created).data).toEqual({ ...common, ...expected, id: expect.any(String) });
    } finally {
      backend.dispose();
    }
  });
});


function boundarySeedConfig(length = 120, oversizedResource?: 'users' | 'roles' | 'menus' | 'departments'): MockConfig {
  const config = customConfig();
  const id = (resource: 'users' | 'roles' | 'menus' | 'departments', prefix: string) => prefix.repeat(resource === oversizedResource ? 121 : length);
  const userId = id('users', 'u'), roleId = id('roles', 'r'), departmentId = id('departments', 'd'), menuId = id('menus', 'm');
  return {
    ...config,
    accounts: [{ ...config.accounts[0], scopes: { north: { ...config.accounts[0].scopes.north!, codes: ['system:users:read', 'system:users:write', 'system:roles:read', 'system:roles:write', 'system:menus:read', 'system:menus:write', 'system:departments:read', 'system:departments:write'] } } }],
    systemSeeds: {
      ...config.systemSeeds,
      north: {
        roles: [{ id: roleId, name: 'Boundary Role', code: 'boundary-role', description: '', enabled: true }],
        departments: [
          { id: departmentId, name: 'Root', code: 'boundary-root', parentId: null, enabled: true },
          { id: 'child-department', name: 'Child', code: 'boundary-child', parentId: departmentId, enabled: true },
        ],
        menus: [
          { id: menuId, title: 'Root Menu', kind: 'group', parentId: null, order: 0, enabled: true },
          { id: 'child-menu', title: 'Child Menu', kind: 'page', pageId: 'custom.home', parentId: menuId, order: 1, enabled: true },
        ],
        users: [{ id: userId, name: 'Boundary User', email: 'boundary@mock.invalid', roleId, departmentId, enabled: true }],
      },
    },
  };
}
describe('review regressions: seed ID consumer boundary', () => {
  it.each(['users', 'roles', 'menus', 'departments'] as const)('accepts 120-character %s IDs and returns record/list wire with intact relations', async resource => {
    const config = boundarySeedConfig();
    const backend = createMockBackend({ config });
    try {
      const auth = headers((await login(backend)).accessToken);
      const list = await backend.dispatch({ method: 'GET', path: `/api/system/${resource}`, headers: auth, query });
      expect(list.status).toBe(200);
      expect(readJsonBody(list).code).toBe(0);
      expect(JSON.parse(JSON.stringify(readJsonBody(list))).data).toEqual({ rows: [...config.systemSeeds.north[resource]].sort((a, b) => a.id.localeCompare(b.id)), rowCount: config.systemSeeds.north[resource].length });
      const row = config.systemSeeds.north[resource][0];
      expect(row.id).toHaveLength(120);
      const detail = await backend.dispatch({ method: 'GET', path: `/api/system/${resource}/${row.id}`, headers: auth, query });
      expect(detail.status).toBe(200);
      expect(readJsonBody(detail).data).toEqual(row);
    } finally { backend.dispose(); }
  });
  it.each(['users', 'roles', 'menus', 'departments'] as const)('rejects 121-character %s seed IDs even with synchronized references', resource => {
    expect(() => createMockBackend({ config: boundarySeedConfig(120, resource) })).toThrow(/Invalid mock config/);
  });
  it.each([
    ['users', 'roleId'], ['users', 'departmentId'], ['menus', 'parentId'], ['departments', 'parentId'],
  ] as const)('validates 120/121-character %s.%s relations on create and update', async (resource, field) => {
    const config = boundarySeedConfig();
    const backend = createMockBackend({ config });
    try {
      const auth = headers((await login(backend)).accessToken);
      const seed = config.systemSeeds.north[resource][resource === 'users' ? 0 : 1];
      const { id, ...input } = seed;
      const reference = (input as Record<string, unknown>)[field];
      expect(reference).toHaveLength(120);
      for (const method of ['POST', 'PUT']) {
        const path = `/api/system/${resource}${method === 'PUT' ? `/${id}` : ''}`;
        const body = { ...input, ...(resource === 'users' && method === 'POST' ? { email: 'created-boundary@mock.invalid' } : {}), ...(resource === 'departments' && method === 'POST' ? { code: 'created-boundary' } : {}) };
        const accepted = await backend.dispatch({ method, path, headers: auth, query, body });
        expect(accepted.status).toBe(200);
        expect(readJsonBody(accepted).data).toMatchObject({ [field]: reference });
        const rejected = await backend.dispatch({ method, path, headers: auth, query, body: { ...body, [field]: `${reference}x` } });
        expect(rejected).toMatchObject({ status: 400, body: { code: 'INVALID_INPUT', data: null } });
      }
    } finally { backend.dispose(); }
  });
});
