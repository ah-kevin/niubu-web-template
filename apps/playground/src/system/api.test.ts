import { expect, it, vi } from 'vitest';
import type { RequestClient, RequestSpec } from '@niubu/request';
import type { AuthContext } from '@niubu/types';
import { createSystemApi } from './api';

it('encodes scope, false filters and paging while preserving explicit JSON writes without replay', async () => {
  const context: AuthContext = { identityKey: 'demo-user', scope: { kind: 'workspace', id: 'north' }, generation: 7 };
  const specs: RequestSpec<unknown>[] = [];
  const row = { id: 'roles-1', name: 'Auditor', code: 'auditor', description: 'Example', enabled: false };
  const client: RequestClient = {
    mode: 'enabled',
    async execute<T>(spec: RequestSpec<T>) {
      specs.push(spec as RequestSpec<unknown>);
      const data = spec.method === 'GET' ? { rows: [row], rowCount: 1 } : row;
      return { ok: true, data: await spec.decode(data) };
    },
    dispose() {},
  };
  const api = createSystemApi(client, () => context);
  expect((await api.roles.list(context, { pageIndex: 0, pageSize: 10, enabled: false, keyword: 'a b' })).ok).toBe(true);
  expect(specs[0]?.query).toMatchObject({
    scopeKind: 'workspace',
    scopeId: 'north',
    pageIndex: 0,
    pageSize: 10,
    enabled: false,
    keyword: 'a b',
  });
  expect(specs[0]?.query).not.toHaveProperty('identityKey');
  expect(specs[0]?.query).not.toHaveProperty('generation');
  expect(
    (await api.roles.create(context, { name: 'Auditor', code: 'auditor', description: 'Example', enabled: false })).ok,
  ).toBe(true);
  expect(specs[1]?.method).toBe('POST');
  expect(specs[1]?.allowReplay).not.toBe(true);
  expect(JSON.parse(String(specs[1]?.body))).toEqual({
    name: 'Auditor',
    code: 'auditor',
    description: 'Example',
    enabled: false,
  });
});
it('rejects a stale captured context before dispatch and before publishing a late response', async () => {
  const old: AuthContext = { identityKey: 'demo-user', scope: { kind: 'workspace', id: 'north' }, generation: 1 };
  let current: AuthContext | null = { ...old, generation: 2 };
  const execute = vi.fn();
  const api = createSystemApi({ mode: 'enabled', execute, dispose() {} }, () => current);
  expect(await api.users.list(old, { pageIndex: 0, pageSize: 10 })).toMatchObject({
    ok: false,
    error: { kind: 'aborted' },
  });
  expect(execute).not.toHaveBeenCalled();
  current = old;
  let release!: (value: unknown) => void;
  execute.mockImplementation(async (spec: RequestSpec<unknown>) => ({
    ok: true,
    data: await spec.decode(
      await new Promise(done => {
        release = done;
      }),
    ),
  }));
  const pending = api.roles.list(old, { pageIndex: 0, pageSize: 10 });
  current = null;
  release({ rows: [], rowCount: 0 });
  expect(await pending).toMatchObject({ ok: false, error: { kind: 'aborted' } });
});

it.each(['menus', 'departments'] as const)('reads a complete %s snapshot through the collection mode without paging or filters', async resource => {
  const context: AuthContext = { identityKey: 'demo', scope: { kind: 'workspace', id: 'north' }, generation: 3 };
  const specs: RequestSpec<unknown>[] = [];
  const client: RequestClient = {
    mode: 'enabled',
    async execute<T>(spec: RequestSpec<T>) { specs.push(spec as RequestSpec<unknown>); return { ok: true, data: await spec.decode({ rows: [], rowCount: 0, complete: true }) }; },
    dispose() {},
  };
  const api = createSystemApi(client, () => context);
  expect(await api[resource].tree(context)).toEqual({ ok: true, data: { rows: [], rowCount: 0, complete: true } });
  expect(specs[0]).toMatchObject({ path: `/api/system/${resource}`, method: 'GET', query: { scopeKind: 'workspace', scopeId: 'north', mode: 'tree' } });
  expect(Object.keys(specs[0]!.query!)).toEqual(['scopeKind', 'scopeId', 'mode']);
  expect(api.users).not.toHaveProperty('tree');
  expect(api.roles).not.toHaveProperty('tree');
});
