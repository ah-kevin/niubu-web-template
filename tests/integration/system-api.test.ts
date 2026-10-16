import { mockFetchResponse } from './mock-response';
import { expect, it } from 'vitest';
import { createRequestClient, isAccessExpired } from '@niubu/request';
import { createAuthSession } from '@niubu/stores';
import type { AuthContext } from '@niubu/types';
import { createMockBackend } from '../../apps/backend-mock/src/dispatcher';
import { createPlaygroundAuthAdapter } from '../../apps/playground/src/auth/adapter';
import { createSessionRequest } from '../../apps/playground/src/auth/request';
import { createSystemApi, unwrapSystemResult } from '../../apps/playground/src/system/api';
import type { InputByResource, ResourceKind, SystemPort } from '../../apps/playground/src/system/contracts';

async function fixture(viewer = false) {
  const backend = createMockBackend();
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const response = await backend.dispatch({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      headers: Object.fromEntries(new Headers(init?.headers)),
      body: init?.body,
    });
    return mockFetchResponse(response);
  };
  const channel = createRequestClient({
    mode: 'enabled',
    baseURL: 'http://playground.test',
    fetch: fetcher,
    credentialsProvider: () => ({ credentials: 'omit' }),
    activityReporter() {},
    errorNormalizer: e => e,
    getGeneration: () => 0,
  });
  const saved = new Map<string, string>();
  const adapter = createPlaygroundAuthAdapter({
    request: channel,
    storage: {
      getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => {
        saved.set(key, value);
      },
      removeItem: key => {
        saved.delete(key);
      },
    },
  });
  await adapter.login(
    { username: viewer ? 'second@playground.invalid' : 'demo@playground.invalid', password: 'demo-only' },
    { signal: new AbortController().signal, assertCurrent() {} },
  );
  const auth = createAuthSession({
    adapter,
    onIdentityReset() {},
    onScopeReset() {},
    reload() {},
    homeHref: '/home',
    loginHref: '/login',
  });
  await auth.restore();
  const base = createRequestClient({
    mode: 'enabled',
    baseURL: 'http://playground.test',
    fetch: fetcher,
    credentialsProvider: signal => adapter.credentialsProvider(signal),
    activityReporter() {},
    errorNormalizer: e => e,
    getGeneration: () => auth.requestContext().generation,
    renewal: {
      shouldRenew: isAccessExpired,
      renew: async signal => {
        try {
          await auth.refresh(signal);
          return { ok: true, data: undefined };
        } catch {
          return { ok: false, error: { kind: 'http', status: 401, code: 'LOGIN_EXPIRED' } };
        }
      },
    },
  });
  adapter.bindGrantRequest(base);
  await auth.switchScope({ kind: 'workspace', id: 'north' });
  const client = createSessionRequest(base, auth);
  const context = (): AuthContext | null => {
    const state = auth.getSnapshot();
    return state.user && state.status === 'ready' && !state.loginExpired
      ? { identityKey: state.user.id, scope: state.scope, generation: state.generation }
      : null;
  };
  const api = createSystemApi(client, context);
  return {
    api,
    auth,
    context: context()!,
    dispose() {
      client.dispose();
      auth.dispose();
      adapter.dispose();
      channel.dispose();
      backend.dispose();
    },
  };
}
it.each(['users', 'roles', 'menus', 'departments'] as const)(
  'client and real dispatcher agree on the complete %s CRUD wire contract',
  async kind => {
    const f = await fixture();
    try {
      const role = unwrapSystemResult(await f.api.roles.list(f.context, { pageIndex: 0, pageSize: 100 })).rows.find(
        row => row.enabled,
      )!;
      const dept = unwrapSystemResult(
        await f.api.departments.list(f.context, { pageIndex: 0, pageSize: 100 }),
      ).rows.find(row => row.enabled)!;
      const inputs: { [K in ResourceKind]: InputByResource[K] } = {
        users: {
          name: 'Created example',
          email: 'created@template.invalid',
          roleId: role.id,
          departmentId: dept.id,
          enabled: false,
        },
        roles: { name: 'Created example', code: 'created-role', description: 'Example', enabled: true },
        menus: {
          title: 'Created example',
          kind: 'external',
          href: 'https://example.com/demo',
          parentId: null,
          order: 20,
          enabled: true,
          openInNewWindow: true,
        },
        departments: { name: 'Created example', code: 'created-dept', parentId: null, enabled: true },
      };
      async function exercise<K extends ResourceKind>(resource: K) {
        const port = f.api[resource] as SystemPort<K>,
          input = inputs[resource];
        const created = unwrapSystemResult(await port.create(f.context, input));
        expect(unwrapSystemResult(await port.get(f.context, created.id)).id).toBe(created.id);
        const changed = {
          ...input,
          ...(resource === 'menus' ? { title: 'Edited example' } : { name: 'Edited example' }),
        };
        expect((await port.update(f.context, created.id, changed)).ok).toBe(true);
        const page = unwrapSystemResult(
          await port.list(f.context, { pageIndex: 0, pageSize: 100, keyword: 'Edited example' }),
        );
        expect(page.rows.some(row => row.id === created.id)).toBe(true);
        expect((await port.remove(f.context, created.id)).ok).toBe(true);
        const missing = await port.get(f.context, created.id);
        expect(missing.ok).toBe(false);
        if (!missing.ok) expect(missing.error.status).toBe(404);
      }
      await exercise(kind);
    } finally {
      f.dispose();
    }
  },
);
it('keeps direct writes forbidden for a read-only user and encodes nullable root filters', async () => {
  const f = await fixture(true);
  try {
    expect((await f.api.roles.list(f.context, { pageIndex: 0, pageSize: 10 })).ok).toBe(true);
    const denied = await f.api.roles.create(f.context, {
      name: 'Denied',
      code: 'denied-role',
      description: '',
      enabled: true,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.status).toBe(403);
    const roots = unwrapSystemResult(
      await f.api.departments.list(f.context, { pageIndex: 0, pageSize: 100, parentId: null }),
    );
    expect(roots.rows.length > 0).toBe(true);
    expect(roots.rows.every(row => row.parentId === null)).toBe(true);
  } finally {
    f.dispose();
  }
});
