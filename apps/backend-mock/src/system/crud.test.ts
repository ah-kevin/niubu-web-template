import { readJsonBody as jsonBody } from '../test-response';
import { afterEach, describe, expect, it } from 'vitest';
import { ACCESS_EXPIRED_CODE } from '@niubu/request/protocol';
import { createMockBackend } from '../dispatcher';
import type { MockRequest, MockResponse } from '../dispatcher';

type Resource = 'users' | 'roles' | 'menus' | 'departments';
type Row = Record<string, unknown> & { id: string };
type Page = { rows: Row[]; rowCount: number };
const resources: Resource[] = ['users', 'roles', 'menus', 'departments'];
const instances: ReturnType<typeof createMockBackend>[] = [];
afterEach(() => {
  for (const backend of instances.splice(0)) backend.dispose();
});
async function setup(username = 'demo@playground.invalid', options = {}) {
  const backend = createMockBackend(options);
  instances.push(backend);
  const login = await backend.dispatch({
    method: 'POST',
    path: '/api/auth/login',
    body: { username, password: 'demo-only' },
  });
  expect(login.status).toBe(200);
  const headers = { authorization: `Bearer ${(jsonBody(login).data as { accessToken: string }).accessToken}` };
  const request = (resource: Resource, method = 'GET', id = '', body?: unknown, extra: Partial<MockRequest> = {}) =>
    backend.dispatch({
      method,
      path: `/api/system/${resource}${id ? `/${id}` : ''}`,
      query: { scopeKind: 'workspace', scopeId: 'north' },
      headers,
      body,
      ...extra,
    });
  return { backend, request, headers };
}
function ok(response: MockResponse) {
  expect(response.status).toBe(200);
  expect(jsonBody(response).code).toBe(0);
  return jsonBody(response).data;
}
function failed(response: MockResponse, status: number, code?: string) {
  expect(response.status).toBe(status);
  expect(jsonBody(response).data).toBeNull();
  if (code) expect(jsonBody(response).code).toBe(code);
}
async function inputFor(request: Awaited<ReturnType<typeof setup>>['request'], resource: Resource) {
  switch (resource) {
    case 'users':
      return {
        name: 'Created user',
        email: 'created@example.invalid',
        roleId: (ok(await request('roles')) as Page).rows[0].id,
        departmentId: (ok(await request('departments')) as Page).rows[0].id,
        enabled: true,
      };
    case 'roles':
      return { name: 'Audit team', code: 'audit-team', description: 'Synthetic example', enabled: true };
    case 'menus':
      return {
        title: 'Created menu',
        kind: 'page',
        pageId: 'playground.system.users',
        parentId: null,
        order: 5,
        enabled: true,
      };
    case 'departments':
      return { name: 'Created department', code: 'created-department', parentId: null, enabled: true };
  }
}

it('persists a newly created role into a later workspace list request', async () => {
  const { request } = await setup();
  ok(
    await request('roles', 'POST', '', {
      name: 'Audit team',
      code: 'audit-team',
      description: 'Synthetic example',
      enabled: true,
    }),
  );
  expect((ok(await request('roles')) as Page).rows.some(row => row.code === 'audit-team')).toBe(true);
});

describe.each(resources)('%s CRUD wire', resource => {
  it('creates, persists into later list/detail, replaces, deletes and returns 404 with stable generated ids', async () => {
    const { request } = await setup();
    const input = await inputFor(request, resource);
    const before = ok(await request(resource)) as Page;
    const created = ok(await request(resource, 'POST', '', input)) as Row;
    expect(created).toMatchObject(input);
    expect(created.id).toMatch(/^[a-z]+-[a-zA-Z0-9_-]+$/);
    const listed = ok(
      await request(resource, 'GET', '', undefined, {
        query: { scopeKind: 'workspace', scopeId: 'north', pageSize: '100' },
      }),
    ) as Page;
    expect(listed.rowCount).toBe(before.rowCount + 1);
    expect(listed.rows).toContainEqual(created);
    expect(ok(await request(resource, 'GET', created.id))).toEqual(created);
    created.enabled = false;
    expect((ok(await request(resource, 'GET', created.id)) as Row).enabled).toBe(true);
    const updatedInput = { ...input, enabled: false };
    const updated = ok(await request(resource, 'PUT', created.id, updatedInput)) as Row;
    expect(updated).toEqual({ id: created.id, ...updatedInput });
    expect(ok(await request(resource, 'GET', created.id))).toEqual(updated);
    expect(ok(await request(resource, 'DELETE', created.id))).toEqual({ id: created.id });
    failed(await request(resource, 'GET', created.id), 404);
    failed(await request(resource, 'PUT', created.id, input), 404);
    failed(await request(resource, 'DELETE', created.id), 404);
    const next = ok(await request(resource, 'POST', '', input)) as Row;
    expect(next.id).not.toBe(created.id);
  });
  it('enforces direct API read/write grants and authenticates before validating writes', async () => {
    const { request, backend } = await setup('second@playground.invalid');
    const first = (ok(await request(resource)) as Page).rows[0];
    ok(await request(resource, 'GET', first.id));
    for (const [method, id] of [
      ['POST', ''],
      ['PUT', first.id],
      ['DELETE', first.id],
    ])
      failed(await request(resource, method, id, '{'), 403);
    failed(await request(resource, 'GET', '', undefined, { query: { scopeKind: 'workspace', scopeId: 'south' } }), 403);
    failed(
      await backend.dispatch({
        method: 'GET',
        path: `/api/system/${resource}`,
        query: { scopeKind: 'workspace', scopeId: 'north' },
      }),
      401,
    );
    failed(await request(resource, 'POST', '', '{', { headers: {} }), 401);
  });
  it('requires exact scope, whitelists scalar queries and caps methods before auth', async () => {
    const { request, backend } = await setup();
    for (const query of [
      {},
      { scopeKind: 'workspace' },
      { scopeId: 'north' },
      { scopeKind: 'team', scopeId: 'north' },
      { scopeKind: 'workspace', scopeId: 'unknown' },
    ] as Record<string, string>[])
      failed(await request(resource, 'GET', '', undefined, { query }), 403);
    for (const suffix of [
      'scopeId=north',
      'scopeKind=workspace',
      'unknown=value',
      'pageIndex=1&pageIndex=2',
      'enabled=0',
      'pageSize=0',
      'pageSize=101',
      'pageSize=1.2',
      'pageIndex=-1',
      'pageIndex=1e2',
      'pageIndex=9007199254740992',
      'pageIndex=+1',
      'pageSize=',
      'sortBy=constructor',
      'sortOrder=up',
      `keyword=${'x'.repeat(101)}`,
    ]) {
      failed(
        await request(resource, 'GET', '', undefined, {
          query: new URLSearchParams(`scopeKind=workspace&scopeId=north&${suffix}`),
        }),
        400,
      );
    }
    for (const [method, path] of [
      ['PATCH', `/api/system/${resource}`],
      ['PUT', `/api/system/${resource}`],
      ['POST', `/api/system/${resource}/missing`],
      ['get', `/api/system/${resource}`],
    ])
      failed(await backend.dispatch({ method, path }), 405);
    failed(
      await request(resource, 'GET', 'missing', undefined, {
        query: { scopeKind: 'workspace', scopeId: 'north', pageSize: '1' },
      }),
      400,
    );
  });
  it('rejects id/scope/unknown/prototype fields, malformed and oversized POST/PUT without partial mutation', async () => {
    const { request } = await setup();
    const input = await inputFor(request, resource);
    const row = ok(await request(resource, 'POST', '', input)) as Row;
    const beforeCount = (ok(await request(resource)) as Page).rowCount;
    for (const [method, id] of [
      ['POST', ''],
      ['PUT', row.id],
    ]) {
      for (const extra of [
        { id: 'chosen' },
        { scopeId: 'south' },
        { scopeKind: 'workspace' },
        { scope: {} },
        { password: 'forbidden' },
        { constructor: 'forbidden' },
        { prototype: {} },
      ])
        failed(await request(resource, method, id, { ...input, ...extra }), 400);
      failed(await request(resource, method, id, JSON.stringify(input).replace(/}$/, ',"__proto__":{}}')), 400);
      failed(await request(resource, method, id, '{'), 400, 'INVALID_JSON');
      failed(await request(resource, method, id, []), 400, 'INVALID_BODY');
      failed(await request(resource, method, id, { ...input, enabled: 'true' }), 400);
      failed(await request(resource, method, id, { ...input, extra: '中'.repeat(23_000) }), 413, 'BODY_TOO_LARGE');
      failed(await request(resource, method, id, { enabled: true }), 400);
    }
    expect(ok(await request(resource, 'GET', row.id))).toEqual(row);
    expect((ok(await request(resource)) as Page).rowCount).toBe(beforeCount);
  });
  it('keeps instances independent, clones list output and restarts from stable seed ids', async () => {
    const a = await setup();
    const b = await setup();
    const initial = ok(await a.request(resource)) as Page;
    expect(ok(await b.request(resource))).toEqual(initial);
    const created = ok(await a.request(resource, 'POST', '', await inputFor(a.request, resource))) as Row;
    failed(await b.request(resource, 'GET', created.id), 404);
    initial.rows[0].enabled = 'tampered';
    expect((ok(await a.request(resource)) as Page).rows[0].enabled).toBeTypeOf('boolean');
    a.backend.dispose();
    failed(await a.request(resource), 503, 'DISPOSED');
    const c = await setup();
    expect(ok(await c.request(resource))).toEqual(ok(await b.request(resource)));
  });
  it('returns explicit access expiry and never applies an expired write', async () => {
    let time = 0;
    const { request, backend } = await setup('demo@playground.invalid', { now: () => time });
    const input = await inputFor(request, resource);
    const row = ok(await request(resource, 'POST', '', input)) as Row;
    time = 300_000;
    for (const [method, id, body] of [
      ['GET', '', undefined],
      ['POST', '', input],
      ['PUT', row.id, { ...input, enabled: false }],
      ['DELETE', row.id, undefined],
    ] as const)
      failed(await request(resource, method, id, body), 401, ACCESS_EXPIRED_CODE);
    const login = await backend.dispatch({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'demo@playground.invalid', password: 'demo-only' },
    });
    const headers = { authorization: `Bearer ${(jsonBody(login).data as { accessToken: string }).accessToken}` };
    expect(ok(await request(resource, 'GET', row.id, undefined, { headers }))).toEqual(row);
  });
});

it('matches routes before auth and never falls back to codes on unknown system paths', async () => {
  const { backend, headers } = await setup();
  for (const path of [
    '/api/system',
    '/api/system/unknown',
    '/api/system/users/',
    '/api/system/users/a/b',
    '/api/system/users/../roles',
    '/api/system/users/%2e%2e',
    '/api/system/users/%2fetc',
    '/api/system/users/a?x=1',
    '/api/system/users/a\\b',
  ]) {
    for (const authHeaders of [{}, headers])
      failed(await backend.dispatch({ method: 'GET', path, headers: authHeaders }), 404);
  }
});

it('seeds 12 users, sorts with id ties, filters before pagination and validates resource-specific queries', async () => {
  const { request } = await setup();
  const first = ok(await request('users')) as Page;
  expect(first.rowCount).toBe(12);
  expect(first.rows).toHaveLength(10);
  const query = (extra: Record<string, string>) => ({ query: { scopeKind: 'workspace', scopeId: 'north', ...extra } });
  const second = ok(await request('users', 'GET', '', undefined, query({ pageIndex: '1' }))) as Page;
  expect(second.rows).toHaveLength(2);
  expect(new Set([...first.rows, ...second.rows].map(row => row.id)).size).toBe(12);
  const input = await inputFor(request, 'users');
  const rows = [];
  for (const email of ['tie1@example.invalid', 'tie2@example.invalid'])
    rows.push(ok(await request('users', 'POST', '', { ...input, name: 'Tie', email, enabled: false })) as Row);
  const filtered = ok(
    await request(
      'users',
      'GET',
      '',
      undefined,
      query({ keyword: 'TIE', enabled: 'false', sortBy: 'name', sortOrder: 'desc', pageSize: '1' }),
    ),
  ) as Page;
  expect(filtered.rowCount).toBe(2);
  expect(filtered.rows[0].id).toBe(rows.map(row => row.id).sort()[0]);
  const byRef = ok(
    await request(
      'users',
      'GET',
      '',
      undefined,
      query({ roleId: input.roleId as string, departmentId: input.departmentId as string, pageSize: '100' }),
    ),
  ) as Page;
  expect(byRef.rows.every(row => row.roleId === input.roleId && row.departmentId === input.departmentId)).toBe(true);
  expect((ok(await request('users', 'GET', '', undefined, query({ pageIndex: '999' }))) as Page).rows).toEqual([]);
  for (const [resource, extra] of [
    ['roles', { roleId: 'x' }],
    ['menus', { kind: 'iframe' }],
    ['users', { sortBy: 'code' }],
    ['roles', { sortBy: 'email' }],
    ['menus', { sortBy: 'name' }],
    ['departments', { kind: 'page' }],
  ] as const)
    failed(await request(resource, 'GET', '', undefined, query(extra)), 400);
});

it('enforces workspace-unique email/code and refuses missing foreign references atomically', async () => {
  const { request } = await setup();
  for (const resource of ['users', 'roles', 'departments'] as const) {
    const input = await inputFor(request, resource);
    const row = ok(await request(resource, 'POST', '', input)) as Row;
    const key = resource === 'users' ? 'email' : 'code';
    failed(
      await request(resource, 'POST', '', {
        ...input,
        [key]: resource === 'users' ? String(input[key]).toUpperCase() : input[key],
      }),
      409,
    );
    const otherInput = { ...input, [key]: resource === 'users' ? 'another@example.invalid' : 'another-code' };
    const other = ok(await request(resource, 'POST', '', otherInput)) as Row;
    failed(await request(resource, 'PUT', other.id, { ...input, enabled: false }), 409);
    expect(ok(await request(resource, 'GET', other.id))).toEqual(other);
    expect(ok(await request(resource, 'GET', row.id))).toEqual(row);
  }
  const userInput = await inputFor(request, 'users');
  const user = ok(await request('users', 'POST', '', { ...userInput, email: 'refs@example.invalid' })) as Row;
  for (const key of ['roleId', 'departmentId']) {
    failed(
      await request('users', 'PUT', user.id, {
        ...userInput,
        email: 'refs@example.invalid',
        [key]: 'missing',
        enabled: false,
      }),
      409,
    );
    expect(ok(await request('users', 'GET', user.id))).toEqual(user);
  }
  failed(await request('roles', 'DELETE', String(userInput.roleId)), 409);
  failed(await request('departments', 'DELETE', String(userInput.departmentId)), 409);
});

it.each(['departments', 'menus'] as const)(
  '%s rejects self/descendant cycles, missing parents and dependent deletes',
  async resource => {
    const { request } = await setup();
    const input =
      resource === 'menus'
        ? { title: 'Root', kind: 'group', parentId: null, order: 0, enabled: true }
        : { name: 'Root', code: 'root-new', parentId: null, enabled: true };
    const root = ok(await request(resource, 'POST', '', input)) as Row;
    const childInput = {
      ...input,
      ...(resource === 'menus' ? { title: 'Child' } : { name: 'Child', code: 'child-new' }),
      parentId: root.id,
    };
    const child = ok(await request(resource, 'POST', '', childInput)) as Row;
    const leaf = ok(
      await request(resource, 'POST', '', {
        ...childInput,
        ...(resource === 'departments' ? { code: 'leaf-new' } : {}),
        parentId: child.id,
      }),
    ) as Row;
    for (const parentId of [root.id, leaf.id, 'missing']) {
      failed(await request(resource, 'PUT', root.id, { ...input, parentId, enabled: false }), 409);
      expect(ok(await request(resource, 'GET', root.id))).toEqual(root);
    }
    failed(await request(resource, 'DELETE', root.id), 409);
    if (resource === 'menus') {
      failed(
        await request(resource, 'PUT', root.id, {
          title: 'Page',
          kind: 'page',
          pageId: 'playground.home',
          parentId: null,
          order: 0,
          enabled: true,
        }),
        409,
      );
      const page = ok(
        await request('menus', 'POST', '', {
          title: 'Page',
          kind: 'page',
          pageId: 'playground.home',
          parentId: null,
          order: 0,
          enabled: true,
        }),
      ) as Row;
      failed(await request('menus', 'POST', '', { ...input, parentId: page.id }), 409);
    }
    ok(await request(resource, 'DELETE', leaf.id));
    ok(await request(resource, 'DELETE', child.id));
    ok(await request(resource, 'DELETE', root.id));
  },
);

it('limits menu page ids and external URLs, clears irrelevant properties and rejects injected route fields', async () => {
  const { request } = await setup();
  const base = { title: 'Menu', parentId: null, order: 0, enabled: true };
  for (const pageId of [
    'playground.home',
    'playground.request',
    ...resources.map(resource => `playground.system.${resource}`),
  ])
    ok(await request('menus', 'POST', '', { ...base, kind: 'page', pageId }));
  for (const href of ['https://example.com/help', 'http://example.com', '/help?tab=one', 'help'])
    ok(await request('menus', 'POST', '', { ...base, kind: 'external', href, openInNewWindow: true }));
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.invalid',
    '/\\evil.invalid',
    ' https://example.com',
    'https://example.com\n',
    'file:///tmp/a',
  ])
    failed(await request('menus', 'POST', '', { ...base, kind: 'external', href }), 400);
  for (const extra of [
    { kind: 'page', pageId: 'unknown.page' },
    { kind: 'page' },
    { kind: 'iframe' },
    { kind: 'external' },
    { kind: 'group', path: '/admin' },
    { kind: 'group', loader: 'arbitrary' },
    { kind: 'group', component: 'arbitrary' },
    { kind: 'group', order: 0.1 },
    { kind: 'group', order: 10_000 },
  ])
    failed(await request('menus', 'POST', '', { ...base, ...extra }), 400);
  const page = ok(await request('menus', 'POST', '', { ...base, kind: 'page', pageId: 'playground.home' })) as Row;
  expect(ok(await request('menus', 'PUT', page.id, { ...base, kind: 'group' }))).toEqual({
    id: page.id,
    ...base,
    kind: 'group',
  });
});

it('keeps mutable role/menu data independent from login and authorization fixtures', async () => {
  const { request, backend, headers } = await setup();
  const before = await Promise.all(
    ['/api/menu', '/api/auth/codes', '/api/user'].map(path => backend.dispatch({ method: 'GET', path, headers })),
  );
  const role = (ok(await request('roles')) as Page).rows[0];
  ok(
    await request('roles', 'PUT', role.id, { name: 'Changed', code: 'changed-code', description: '', enabled: false }),
  );
  const menu = (ok(await request('menus')) as Page).rows.find(row => row.kind === 'page')!;
  ok(await request('menus', 'DELETE', menu.id));
  const after = await Promise.all(
    ['/api/menu', '/api/auth/codes', '/api/user'].map(path => backend.dispatch({ method: 'GET', path, headers })),
  );
  expect(after).toEqual(before);
});

it.each(resources)(
  '%s data persists independently in both workspaces with foreign-workspace ids rejected',
  async resource => {
    const { createSystemRepository } = await import('./repository');
    const repository = createSystemRepository();
    const query = { pageIndex: 0, pageSize: 100, sortBy: 'id', sortOrder: 'asc' as const };
    try {
      const northBefore = repository.list('north', resource, query);
      const southBefore = repository.list('south', resource, query);
      expect(northBefore.rowCount).toBe(resource === 'users' ? 12 : resource === 'menus' ? 3 : 2);
      expect(southBefore.rowCount).toBe(northBefore.rowCount);
      const input = (workspace: 'north' | 'south') =>
        resource === 'users'
          ? {
              name: 'Same',
              email: 'same@example.invalid',
              roleId: repository.list(workspace, 'roles', query).rows[0].id,
              departmentId: repository.list(workspace, 'departments', query).rows[0].id,
              enabled: true,
            }
          : resource === 'roles'
            ? { name: 'Same', code: 'same-code', description: '', enabled: true }
            : resource === 'departments'
              ? { name: 'Same', code: 'same-code', parentId: null, enabled: true }
              : { title: 'Same', kind: 'group', parentId: null, order: 0, enabled: true };
      const north = repository.create('north', resource, input('north'));
      expect(repository.list('south', resource, query)).toEqual(southBefore);
      const south = repository.create('south', resource, input('south'));
      expect(() => repository.get('south', resource, north.id)).toThrowError();
      expect(() => repository.get('north', resource, south.id)).toThrowError();
      repository.update('north', resource, north.id, { ...input('north'), enabled: false });
      expect(repository.get('south', resource, south.id).enabled).toBe(true);
      if (resource === 'users') {
        const foreign = input('north');
        expect(() => repository.update('south', 'users', south.id, foreign)).toThrowError(
          expect.objectContaining({ status: 409 }),
        );
      }
      if (resource === 'departments' || resource === 'menus')
        expect(() =>
          repository.update('south', resource, south.id, { ...input('south'), parentId: north.id }),
        ).toThrowError(expect.objectContaining({ status: 409 }));
      repository.remove('north', resource, north.id);
      expect(repository.list('north', resource, query)).toEqual(northBefore);
      expect(repository.get('south', resource, south.id)).toMatchObject({ enabled: true });
      repository.dispose();
      expect(() => repository.list('north', resource, query)).toThrowError(expect.objectContaining({ status: 503 }));
    } finally {
      repository.dispose();
    }
  },
);

it('checks verified workspace membership even when a profile carries matching capability codes', async () => {
  const { createSystemRepository } = await import('./repository');
  const { dispatchSystem, matchSystemRoute } = await import('./dispatch');
  const repository = createSystemRepository();
  try {
    const route = matchSystemRoute('/api/system/roles')!;
    expect(() =>
      dispatchSystem(
        repository,
        route,
        { method: 'GET', path: '/api/system/roles' },
        new URLSearchParams({ scopeKind: 'workspace', scopeId: 'south' }),
        { memberships: [{ id: 'north' }], codesFor: () => ['system:roles:read'] },
      ),
    ).toThrowError(expect.objectContaining({ status: 403, code: 'UNKNOWN_SCOPE' }));
  } finally {
    repository.dispose();
  }
});

it.each(resources)('%s validates field lengths and types rather than accepting coercions', async resource => {
  const { request } = await setup();
  const input = await inputFor(request, resource);
  const nameKey = resource === 'menus' ? 'title' : 'name';
  for (const value of ['', '   ', 'x'.repeat(81), 1, null])
    failed(await request(resource, 'POST', '', { ...input, [nameKey]: value }), 400);
  ok(await request(resource, 'POST', '', { ...input, [nameKey]: 'x'.repeat(80) }));
  const invalidValues =
    resource === 'users'
      ? [
          { email: 'invalid' },
          { email: 'x@invalid' },
          { email: ' space@example.invalid' },
          { roleId: '' },
          { departmentId: null },
        ]
      : resource === 'roles'
        ? [
            { code: 'A!' },
            { code: 'a' },
            { code: 'x'.repeat(65) },
            { description: 'x'.repeat(501) },
            { description: null },
          ]
        : resource === 'departments'
          ? [{ code: 'bad code' }, { parentId: undefined }, { parentId: '' }]
          : [{ order: -1 }, { order: '1' }, { parentId: '' }, { openInNewWindow: 'true' }];
  for (const patch of invalidValues) failed(await request(resource, 'POST', '', { ...input, ...patch }), 400);
});

it('accepts exactly 65536 bytes for POST and PUT and rejects the next byte without modifying records', async () => {
  const { request } = await setup();
  const input = { name: 'Exact body limit', code: 'exact-body-limit', description: '', enabled: true };
  const json = JSON.stringify(input);
  const body = json + ' '.repeat(65_536 - Buffer.byteLength(json));
  const row = ok(await request('roles', 'POST', '', body)) as Row;
  ok(await request('roles', 'PUT', row.id, body));
  failed(await request('roles', 'PUT', row.id, body + ' '), 413, 'BODY_TOO_LARGE');
  expect(ok(await request('roles', 'GET', row.id))).toEqual(row);
});

it('uses literal parentId=null for department roots, with absence meaning all and empty invalid', async () => {
  const { request } = await setup();
  const query = (parentId?: string) => ({
    query: { scopeKind: 'workspace', scopeId: 'north', ...(parentId === undefined ? {} : { parentId }) },
  });
  expect((ok(await request('departments')) as Page).rowCount).toBe(2);
  const roots = ok(await request('departments', 'GET', '', undefined, query('null'))) as Page;
  expect(roots.rowCount).toBe(1);
  expect(roots.rows[0].parentId).toBeNull();
  const children = ok(await request('departments', 'GET', '', undefined, query(roots.rows[0].id))) as Page;
  expect(children.rowCount).toBe(1);
  expect(children.rows[0].parentId).toBe(roots.rows[0].id);
  failed(await request('departments', 'GET', '', undefined, query('')), 400);
});

it.each(resources)(
  '%s denies every south capability for admin despite north writes and rejects client identity/generation query',
  async resource => {
    const { request } = await setup();
    for (const [method, id] of [
      ['GET', ''],
      ['POST', ''],
      ['PUT', 'missing'],
      ['DELETE', 'missing'],
    ])
      failed(await request(resource, method, id, '{', { query: { scopeKind: 'workspace', scopeId: 'south' } }), 403);
    for (const field of ['identity', 'identityKey', 'generation'])
      failed(
        await request(resource, 'GET', '', undefined, {
          query: { scopeKind: 'workspace', scopeId: 'north', [field]: 'forged' },
        }),
        400,
      );
  },
);

it.each(['users', 'roles', 'menus', 'departments'] as const)(
  '%s filters keyword/enabled and sorts every declared key before paging',
  async resource => {
    const { request } = await setup();
    const input = await inputFor(request, resource);
    const name = resource === 'menus' ? 'title' : 'name';
    const extra = (letter: string) =>
      resource === 'users'
        ? { email: `sortcase-${letter}@example.invalid` }
        : resource === 'menus'
          ? { order: letter === 'a' ? 1 : 2, kind: 'group' }
          : { code: `sortcase-${letter}` };
    const high = ok(
      await request(resource, 'POST', '', { ...input, [name]: 'Sortcase Z', ...extra('z'), enabled: false }),
    ) as Row;
    const low = ok(
      await request(resource, 'POST', '', { ...input, [name]: 'Sortcase A', ...extra('a'), enabled: false }),
    ) as Row;
    const keys =
      resource === 'users' ? ['name', 'email'] : resource === 'menus' ? ['title', 'order'] : ['name', 'code'];
    for (const sortBy of keys) {
      const query = (sortOrder: string) => ({
        query: {
          scopeKind: 'workspace',
          scopeId: 'north',
          keyword: 'SORTCASE',
          enabled: 'false',
          sortBy,
          sortOrder,
          pageSize: '1',
        },
      });
      const asc = ok(await request(resource, 'GET', '', undefined, query('asc'))) as Page;
      expect(asc.rowCount).toBe(2);
      expect(asc.rows[0].id).toBe(low.id);
      expect((ok(await request(resource, 'GET', '', undefined, query('desc'))) as Page).rows[0].id).toBe(high.id);
    }
    if (resource === 'menus') {
      const page = ok(
        await request(resource, 'GET', '', undefined, {
          query: { scopeKind: 'workspace', scopeId: 'north', kind: 'group', keyword: 'SORTCASE' },
        }),
      ) as Page;
      expect(page.rowCount).toBe(2);
      expect(page.rows.every(row => row.kind === 'group')).toBe(true);
    }
  },
);

it('rejects malformed email shapes as validation errors', async () => {
  const { request } = await setup();
  const input = await inputFor(request, 'users');
  for (const email of [
    'a..b@example.invalid',
    '.a@example.invalid',
    'a.@example.invalid',
    'a<b@example.invalid',
    'a@-example.invalid',
    'a@example-.invalid',
  ])
    failed(await request('users', 'POST', '', { ...input, email }), 400);
});

it('rejects deeply nested non-scalar fields with 400 rather than an internal error', async () => {
  const { request } = await setup();
  const nested = '['.repeat(16_000) + '0' + ']'.repeat(16_000);
  for (const field of ['unknown', 'name']) {
    const body = JSON.stringify({ name: 'Deep body', code: 'deep-body', description: '', enabled: true }).replace(
      /}$/,
      `,"${field}":${nested}}`,
    );
    failed(await request('roles', 'POST', '', body), 400);
  }
  expect((ok(await request('roles')) as Page).rowCount).toBe(2);
});
