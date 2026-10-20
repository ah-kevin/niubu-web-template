import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { createMockBackend } from '../../apps/backend-mock/src/dispatcher';
import { createStarterMockConfig } from '../../apps/backend-mock/src/profiles';
import { startStarter } from '../../apps/starter/src/main';
import { appIdentity } from '../../apps/starter/src/app/config';
import { registry } from '../../apps/starter/src/modules/demo';
import { createEditorOptions } from '../../apps/starter/src/system/form-schemas';
import { menuInputSchema } from '../../apps/starter/src/system/schemas';
import { emptyLookups } from '../../apps/starter/src/system/resource-config';
import { mockFetchResponse } from './mock-response';

const disposers: (() => void)[] = [];
it('offers only registered menu pages accepted by both app and mock', () => {
  const options = createEditorOptions('menus', key => key, emptyLookups);
  const pages = (options.fields.find(field => field.name === 'pageId')!.componentProps as { options: { value: string; label: string }[] }).options;
  expect(pages.map(page => page.value)).toEqual(createStarterMockConfig().navigablePageIds);
  for (const page of pages) {
    const route = registry.routes.find(route => route.id === page.value)!;
    expect(page.label).toBe(route.titleKey);
    expect(menuInputSchema.safeParse({ title: 'Valid page', kind: 'page', pageId: page.value, parentId: null, order: 0, enabled: true }).success).toBe(true);
  }
});
afterEach(async () => {
  await act(async () => disposers.splice(0).reverse().forEach(dispose => dispose()));
  document.body.innerHTML = ''; localStorage.clear(); sessionStorage.clear();
});

it('ships only login, protected home, account profile and the four code-owned system pages', () => {
  expect(registry.routes.map(route => route.path).sort()).toEqual(['/home', '/login', '/profile', '/system/departments', '/system/menus', '/system/roles', '/system/users']);
  expect(registry.routes.find(route => route.path === '/home')?.scope).toBe('workspace');
  expect(appIdentity.storageNamespace).toBe('starter');
  expect(registry.routes.every(route => route.id.startsWith('starter.'))).toBe(true);
});

it('does not start requests or owners after an already cancelled startup', async () => {
  const root = document.createElement('div'); document.body.append(root);
  const signal = AbortSignal.abort(); const fetcher = vi.fn();
  await expect(startStarter(root, { signal, fetch: fetcher })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetcher).not.toHaveBeenCalled(); expect(root.childElementCount).toBe(0);
});

it.each([['admin', true], ['viewer', false]] as const)('restores %s, admits system pages and retires the identity on logout', async (username, writable) => {
  const backend = createMockBackend({ config: createStarterMockConfig() }); disposers.push(() => backend.dispose());
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    return mockFetchResponse(await backend.dispatch({ method: init?.method ?? 'GET', path: url.pathname, query: url.searchParams, headers: Object.fromEntries(new Headers(init?.headers)), body: init?.body }));
  };
  const login = await backend.dispatch({ method: 'POST', path: '/api/auth/login', body: { username, password: username } });
  if (login.kind !== 'json') throw new Error('Expected JSON login');
  const values = new Map([['starter.auth.v1', JSON.stringify({ version: 1, tokens: login.body.data })]]);
  const root = document.createElement('div'); document.body.append(root);
  let runtime!: Awaited<ReturnType<typeof startStarter>>;
  await act(async () => {
    runtime = await startStarter(root, { runtimeConfig: { schemaVersion: 1, apiURL: '/' }, fetch: fetcher, reload: vi.fn(),
      updateFetch: async () => new Response(null, { status: 200 }),
      authStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } },
      createRouter: routes => createMemoryRouter(routes, { initialEntries: ['/system/users?scopeKind=workspace&scopeId=north'] }),
    });
  });
  disposers.push(runtime.dispose);
  await waitFor(() => expect(runtime.auth.getSnapshot().status).toBe('ready'));
  await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  expect(runtime.access().grantedPageIds).toContain('starter.system.users');
  expect(runtime.auth.getSnapshot().codes.includes('system:users:write')).toBe(writable);
  if (!writable) expect(screen.queryByRole('button', { name: '新增用户' })).not.toBeInTheDocument();
  await act(async () => runtime.auth.logout());
  await waitFor(() => expect(runtime.auth.getSnapshot().user).toBeNull());
  expect(runtime.queryClient.getQueryCache().getAll().some(query => query.queryKey.includes('starter-admin'))).toBe(false);
});
