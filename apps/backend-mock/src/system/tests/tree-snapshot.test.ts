import { afterEach, describe, expect, it } from 'vitest';
import type { MockConfig, MockSystemSeed } from '../../config';
import { createMockBackend } from '../../dispatcher';
import type { MockRequest, MockResponse } from '../../dispatcher';
import { defaultMockConfig } from '../../fixtures';
import { readJsonBody } from '../../test-response';
import type { DepartmentRecord, MenuRecord } from '../contracts';
import { createSystemRepository } from '../repository';

const resources = ['menus', 'departments'] as const;
type HierarchyResource = (typeof resources)[number];
type Snapshot = { rows: (DepartmentRecord | MenuRecord)[]; rowCount: number; complete: true };
const instances: ReturnType<typeof createMockBackend>[] = [];
afterEach(() => {
  for (const backend of instances.splice(0)) backend.dispose();
});

function hierarchySeed(): MockSystemSeed {
  const nodes = [
    { id: 'tree', parentId: null },
    ...Array.from({ length: 104 }, (_, index) => ({
      id: `node-${String(index).padStart(3, '0')}`,
      parentId: index === 1 ? 'node-000' : 'tree',
    })),
  ];
  return {
    users: [],
    roles: [],
    menus: nodes.map((node, index) => ({
      ...node,
      title: `Menu ${index}`,
      kind: 'group',
      order: index,
      enabled: index !== 2,
    })),
    departments: nodes.map((node, index) => ({
      ...node,
      name: `Department ${index}`,
      code: `department-${index}`,
      enabled: index !== 2,
    })),
  };
}
function configWithSeed(seed: MockSystemSeed): MockConfig {
  return { ...defaultMockConfig, systemSeeds: { ...defaultMockConfig.systemSeeds, north: seed } };
}
async function setup(config: MockConfig = defaultMockConfig, username = 'demo@playground.invalid') {
  const backend = createMockBackend({ config });
  instances.push(backend);
  const login = await backend.dispatch({
    method: 'POST',
    path: '/api/auth/login',
    body: { username, password: 'demo-only' },
  });
  expect(login.status).toBe(200);
  const token = readJsonBody(login).data as { accessToken: string };
  const headers = { authorization: `Bearer ${token.accessToken}` };
  const request = (resource: HierarchyResource, extra: Partial<MockRequest> = {}) =>
    backend.dispatch({
      method: 'GET',
      path: `/api/system/${resource}`,
      query: { scopeKind: 'workspace', scopeId: 'north', mode: 'tree' },
      headers,
      ...extra,
    });
  return { backend, request, headers };
}
function ok(response: MockResponse) {
  expect(response.status).toBe(200);
  expect(readJsonBody(response).code).toBe(0);
  return readJsonBody(response).data;
}
function failed(response: MockResponse, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(readJsonBody(response).code).toBe(code);
  expect(readJsonBody(response).data).toBeNull();
}

describe.each(resources)('%s complete tree snapshot', resource => {
  it('returns every flat DTO including disabled descendants across the old page boundary', async () => {
    const seed = hierarchySeed();
    const { request } = await setup(configWithSeed(seed));
    const snapshot = ok(await request(resource)) as Snapshot;
    expect(snapshot).toEqual({ rows: seed[resource], rowCount: 105, complete: true });
    expect(snapshot.rows.find(row => row.id === 'node-001')).toMatchObject({ parentId: 'node-000', enabled: false });
    const page = (pageIndex: string) => ({
      query: { scopeKind: 'workspace', scopeId: 'north', pageSize: '100', pageIndex },
    });
    const first = ok(await request(resource, page('0'))) as Omit<Snapshot, 'complete'>;
    const second = ok(await request(resource, page('1'))) as Omit<Snapshot, 'complete'>;
    expect(first.rowCount).toBe(105);
    expect(first.rows).toHaveLength(100);
    expect(first.rows[0].id).toBe('node-000');
    expect(second).toMatchObject({ rowCount: 105 });
    expect(second.rows).toHaveLength(5);
    expect(second.rows.at(-1)?.id).toBe('tree');
    expect(first).not.toHaveProperty('complete');
    expect(second).not.toHaveProperty('complete');
    failed(
      await request(resource, { query: { scopeKind: 'workspace', scopeId: 'north', pageSize: '101' } }),
      400,
      'INVALID_INPUT',
    );
  });

  it('returns independent snapshots and a complete empty collection', async () => {
    const seed = hierarchySeed();
    const { request } = await setup(configWithSeed(seed));
    const first = ok(await request(resource)) as Snapshot;
    first.rows[0].enabled = false;
    first.rows.splice(1);
    expect(ok(await request(resource))).toEqual({ rows: seed[resource], rowCount: 105, complete: true });
    const empty = await setup(configWithSeed({ users: [], roles: [], menus: [], departments: [] }));
    expect(ok(await empty.request(resource))).toEqual({ rows: [], rowCount: 0, complete: true });
  });

  it('keeps read grants, authenticated sessions and exact member workspace authorization', async () => {
    const viewer = await setup(defaultMockConfig, 'second@playground.invalid');
    expect(ok(await viewer.request(resource))).toMatchObject({ complete: true });
    failed(await viewer.request(resource, { headers: {} }), 401, 'UNAUTHENTICATED');
    failed(
      await viewer.request(resource, { query: { scopeKind: 'workspace', scopeId: 'south', mode: 'tree' } }),
      403,
      'FORBIDDEN',
    );
    const writeOnly: MockConfig = {
      ...defaultMockConfig,
      accounts: defaultMockConfig.accounts.map(account => ({
        ...account,
        scopes: {
          ...account.scopes,
          north: { menu: [], codes: [`system:${resource}:write`] },
        },
      })),
    };
    const writer = await setup(writeOnly);
    failed(await writer.request(resource), 403, 'FORBIDDEN');
    const nonMember = await setup({
      ...defaultMockConfig,
      accounts: defaultMockConfig.accounts.map(account => ({
        ...account,
        user: { ...account.user, workspaces: account.user.workspaces.filter(workspace => workspace.id === 'north') },
        scopes: { north: account.scopes.north },
      })),
    });
    failed(
      await nonMember.request(resource, { query: { scopeKind: 'workspace', scopeId: 'south', mode: 'tree' } }),
      403,
      'UNKNOWN_SCOPE',
    );
    const invalidScopes: Record<string, string>[] = [
      { mode: 'tree' },
      { scopeKind: 'workspace', mode: 'tree' },
      { scopeId: 'north', mode: 'tree' },
      { scopeKind: 'team', scopeId: 'north', mode: 'tree' },
      { scopeKind: 'workspace', scopeId: 'unknown', mode: 'tree' },
    ];
    for (const query of invalidScopes) failed(await viewer.request(resource, { query }), 403, 'UNKNOWN_SCOPE');
  });

  it('rejects pagination, sorting, filters, unknown and repeated parameters in tree mode', async () => {
    const { request } = await setup();
    for (const suffix of [
      'pageIndex=0',
      'pageSize=100',
      'sortBy=id',
      'sortOrder=asc',
      'keyword=',
      'enabled=false',
      'kind=group',
      'parentId=null',
      'roleId=role-north-operator',
      'departmentId=department-north-root',
      'sorting=[]',
      'filters={}',
      'unexpected=value',
      'scopeKind=workspace',
      'scopeId=north',
      'mode=tree',
    ])
      failed(
        await request(resource, {
          query: new URLSearchParams(`scopeKind=workspace&scopeId=north&mode=tree&${suffix}`),
        }),
        400,
        'INVALID_INPUT',
      );
    for (const mode of ['', 'list', 'TREE', 'tree '])
      failed(
        await request(resource, { query: { scopeKind: 'workspace', scopeId: 'north', mode } }),
        400,
        'INVALID_INPUT',
      );
  });

  it('reads only the requested workspace when that workspace grants read access', async () => {
    const seed = hierarchySeed();
    const { request } = await setup({
      ...configWithSeed(seed),
      accounts: defaultMockConfig.accounts.map(account => ({
        ...account,
        scopes: {
          ...account.scopes,
          south: { menu: [], codes: [`system:${resource}:read`] },
        },
      })),
    });
    expect(ok(await request(resource, { query: { scopeKind: 'workspace', scopeId: 'south', mode: 'tree' } }))).toEqual({
      rows: defaultMockConfig.systemSeeds.south[resource],
      rowCount: resource === 'menus' ? 3 : 2,
      complete: true,
    });
    expect(ok(await request(resource))).toEqual({ rows: seed[resource], rowCount: 105, complete: true });
  });

  it('preserves id tree as a detail path and refuses mode on details and writes', async () => {
    const seed = hierarchySeed();
    const { request, backend, headers } = await setup(configWithSeed(seed));
    const path = `/api/system/${resource}/tree`;
    const scope = { scopeKind: 'workspace', scopeId: 'north' };
    expect(ok(await request(resource, { path, query: scope }))).toEqual(seed[resource][0]);
    failed(await request(resource, { path }), 400, 'INVALID_INPUT');
    for (const [method, target] of [
      ['POST', `/api/system/${resource}`],
      ['PUT', path],
      ['DELETE', path],
    ])
      failed(await request(resource, { method, path: target, body: {} }), 400, 'INVALID_INPUT');
    for (const [method, target] of [
      ['PUT', `/api/system/${resource}`],
      ['DELETE', `/api/system/${resource}`],
      ['POST', path],
      ['PATCH', path],
    ])
      failed(
        await backend.dispatch({ method, path: target, headers, query: { ...scope, mode: 'tree' } }),
        405,
        'METHOD_NOT_ALLOWED',
      );
  });

  it('retains missing-parent, cycle and dependent-delete constraints without altering the snapshot', async () => {
    const { request } = await setup(configWithSeed(hierarchySeed()));
    const before = ok(await request(resource));
    const input =
      resource === 'menus'
        ? { title: 'Root', kind: 'group', order: 0, enabled: true }
        : { name: 'Root', code: 'root-updated', enabled: true };
    const scope = { scopeKind: 'workspace', scopeId: 'north' };
    for (const parentId of ['missing', 'node-001'])
      failed(
        await request(resource, {
          method: 'PUT',
          path: `/api/system/${resource}/tree`,
          query: scope,
          body: { ...input, parentId },
        }),
        409,
        'CONFLICT',
      );
    failed(
      await request(resource, { method: 'DELETE', path: `/api/system/${resource}/tree`, query: scope }),
      409,
      'CONFLICT',
    );
    if (resource === 'menus')
      failed(
        await request(resource, {
          method: 'PUT',
          path: '/api/system/menus/tree',
          query: scope,
          body: {
            title: 'Page parent',
            kind: 'page',
            pageId: 'playground.home',
            order: 0,
            parentId: null,
            enabled: true,
          },
        }),
        409,
        'CONFLICT',
      );
    expect(ok(await request(resource))).toEqual(before);
  });
});

it.each(resources)('%s repository snapshot cannot mutate stored records or another snapshot', resource => {
  const repository = createSystemRepository({ seeds: { north: hierarchySeed(), south: hierarchySeed() } });
  try {
    const first = repository.tree('north', resource);
    const second = repository.tree('north', resource);
    first.rows[0].enabled = false;
    first.rows.pop();
    expect(repository.get('north', resource, 'tree').enabled).toBe(true);
    expect(second.rows).toHaveLength(105);
    expect(second.rows[0].enabled).toBe(true);
    repository.update(
      'north',
      resource,
      'tree',
      resource === 'menus'
        ? { title: 'Updated', kind: 'group', parentId: null, order: 0, enabled: false }
        : { name: 'Updated', code: 'updated', parentId: null, enabled: false },
    );
    expect(second.rows[0].enabled).toBe(true);
    expect(repository.tree('north', resource).rows[0].enabled).toBe(false);
    expect(repository.tree('south', resource).rows[0].enabled).toBe(true);
  } finally {
    repository.dispose();
  }
});

it.each(['users', 'roles'])('%s never accepts tree mode', async resource => {
  const { backend, headers } = await setup();
  failed(
    await backend.dispatch({
      method: 'GET',
      path: `/api/system/${resource}`,
      headers,
      query: { scopeKind: 'workspace', scopeId: 'north', mode: 'tree' },
    }),
    400,
    'INVALID_INPUT',
  );
});
