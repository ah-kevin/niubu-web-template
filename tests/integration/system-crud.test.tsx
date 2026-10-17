import { mockFetchResponse } from './mock-response';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { createRequestClient } from '@niubu/request';
import { createMockBackend } from '../../apps/backend-mock/src/dispatcher';
import { createPlaygroundAuthAdapter } from '../../apps/playground/src/auth/adapter';
import { startPlayground } from '../../apps/playground/src/main';
import type { ResourceKind } from '../../apps/playground/src/system/contracts';

const cleanups: Array<() => void> = [];
afterEach(async () => {
  await act(async () => {
    for (const dispose of cleanups.splice(0).reverse()) dispose();
  });
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
});
const methods = ['scrollIntoView', 'hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const;
const originals = methods.map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
beforeAll(() => {
  for (const key of methods)
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      value: key === 'hasPointerCapture' ? () => false : () => {},
    });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerType = 'mouse';
      pointerId = 1;
    },
  );
});
afterAll(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, key);
  }
  vi.unstubAllGlobals();
});
async function fixture(resource: ResourceKind, viewer = false) {
  let now = 0;
  const backend = createMockBackend({ now: () => now });
  cleanups.push(() => backend.dispose());
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const calls: Array<{ path: string; method: string; query: URLSearchParams; body: unknown; status: number }> = [];
  let authorization = '';
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)),
      headers = new Headers(init?.headers);
    if (headers.has('Authorization')) authorization = headers.get('Authorization')!;
    const response = await backend.dispatch({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      headers: Object.fromEntries(headers),
      body: init?.body,
    });
    calls.push({
      path: url.pathname,
      method: init?.method ?? 'GET',
      query: url.searchParams,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      status: response.status,
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
  const adapter = createPlaygroundAuthAdapter({ request: channel, storage });
  await adapter.login(
    { username: viewer ? 'second@playground.invalid' : 'demo@playground.invalid', password: 'demo-only' },
    { signal: new AbortController().signal, assertCurrent() {} },
  );
  adapter.dispose();
  channel.dispose();
  const root = document.createElement('div');
  document.body.append(root);
  let runtime!: Awaited<ReturnType<typeof startPlayground>>;
  await act(async () => {
    runtime = await startPlayground(root, { runtimeConfig: {schemaVersion:1,apiURL:'/'},
      fetch: fetcher,
      authStorage: storage,
      reload: vi.fn(),
      createRouter: routes =>
        createMemoryRouter(routes, { initialEntries: ['/system/' + resource + '?scopeKind=workspace&scopeId=north'] }),
    });
  });
  cleanups.push(() => {
    runtime.dispose();
    root.remove();
  });
  await screen.findByRole('table');
  await waitFor(() =>
    expect(calls.some(call => call.path === '/api/system/' + resource && call.status === 200)).toBe(true),
  );
  return {
    runtime,
    calls,
    expire() {
      now = 300_001;
    },
    async rows(keyword = '') {
      const query = new URLSearchParams({
        scopeKind: 'workspace',
        scopeId: 'north',
        pageIndex: '0',
        pageSize: '100',
        keyword,
      });
      const response = await backend.dispatch({
        method: 'GET',
        path: '/api/system/' + resource,
        query,
        headers: { Authorization: authorization },
      });
      expect(response.status).toBe(200);
      if (response.kind !== 'json') throw new Error('Expected JSON system records');
      const body = response.body as {
        code: number;
        data: { rows: Array<{ id: string; name?: string; title?: string }> };
      };
      expect(body.code).toBe(0);
      return body.data.rows;
    },
  };
}
const titles = { users: '用户管理', roles: '角色管理', menus: '菜单管理', departments: '部门管理' };
async function choose(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: label }), { key: ' ', code: 'Space' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}
async function fill(resource: ResourceKind, name: string) {
  fireEvent.change(screen.getByRole('textbox', { name: resource === 'menus' ? '标题' : '名称' }), {
    target: { value: name },
  });
  if (resource === 'users') {
    fireEvent.change(screen.getByRole('textbox', { name: '邮箱' }), { target: { value: 'created@template.invalid' } });
    await choose('角色', 'Operator');
    await choose('部门', 'Head office');
  } else if (resource !== 'menus')
    fireEvent.change(screen.getByRole('textbox', { name: '编码' }), { target: { value: 'new-record' } });
}
async function confirmSave() {
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '确认保存' }));
}
async function query(keyword: string) {
  if (!screen.queryByRole('textbox', { name: '关键词' }))
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  await act(async () => {
    fireEvent.change(screen.getByRole('textbox', { name: '关键词' }), { target: { value: keyword } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
  });
}
it.each(['users', 'roles', 'menus', 'departments'] as const)(
  'persists complete %s CRUD through actual app, schema form, client and dispatcher',
  async resource => {
    const f = await fixture(resource);
    expect(await screen.findByRole('heading', { name: titles[resource] })).toBeVisible();
    const createLabel = { users: '新增用户', roles: '新增角色', menus: '新增菜单', departments: '新增部门' }[resource];
    const toolbar = within(screen.getByRole('toolbar', { name: titles[resource] }));
    await waitFor(() => expect(toolbar.getByRole('button', { name: createLabel })).toBeEnabled());
    fireEvent.click(toolbar.getByRole('button', { name: createLabel }));
    await fill(resource, 'Created example');
    await confirmSave();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const created = await f.rows('Created example');
    expect(created).toHaveLength(1);
    await query('Created example');
    fireEvent.click(await screen.findByRole('button', { name: '查看 Created example' }));
    await waitFor(() =>
      expect(f.calls.filter(call => call.path.endsWith('/' + created[0].id)).at(-1)?.status).toBe(200),
    );
    const detail = await screen.findByRole('dialog');
    expect(within(detail).getByText('Created example', { selector: 'dd' })).toBeVisible();
    expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(within(detail).getByRole('button', { name: '关闭' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑 Created example' }));
    const input = await screen.findByRole('textbox', { name: resource === 'menus' ? '标题' : '名称' });
    fireEvent.change(input, { target: { value: 'Edited example' } });
    await confirmSave();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await f.rows('Created example')).toHaveLength(0);
    expect((await f.rows('Edited example')).map(row => row.id)).toEqual([created[0].id]);
    await query('Edited example');
    fireEvent.click(await screen.findByRole('button', { name: '删除 Edited example' }));
    const deletion = await screen.findByRole('alertdialog');
    expect(await f.rows('Edited example')).toHaveLength(1);
    fireEvent.click(within(deletion).getByRole('button', { name: '确定' }));
    await waitFor(() => expect(f.calls.some(call => call.method === 'DELETE' && call.status === 200)).toBe(true));
    expect(await f.rows('Edited example')).toHaveLength(0);
    expect(f.calls.filter(call => call.method === 'POST' && call.path === '/api/system/' + resource)).toHaveLength(1);
    expect(
      f.calls.filter(call => call.method === 'PUT' && call.path.startsWith('/api/system/' + resource + '/')),
    ).toHaveLength(1);
  },
);
it('renders the actual second users page and enforces viewer actions', async () => {
  const f = await fixture('users', true);
  expect(await screen.findByRole('cell', { name: 'Example avery' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '新增用户' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /编辑 Example/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(await screen.findByRole('cell', { name: 'Example kai' })).toBeVisible();
  expect(f.calls.some(call => call.query.get('pageIndex') === '1' && call.status === 200)).toBe(true);
});
it('preserves the exact editor and dirty input on cancelled scope navigation and same-person login', async () => {
  const f = await fixture('roles');
  fireEvent.click(await screen.findByRole('button', { name: '新增角色' }));
  await fill('roles', 'Preserved input');
  const input = screen.getByRole('textbox', { name: '名称' }),
    router = f.runtime.router;
  await act(async () => {
    void router.navigate('/system/roles?scopeKind=workspace&scopeId=south');
  });
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '继续编辑' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(f.runtime.auth.getSnapshot().scope?.id).toBe('north');
  expect(router.state.location.search).toContain('scopeId=north');
  expect(screen.getByRole('textbox', { name: '名称' })).toBe(input);
  await act(async () => f.runtime.auth.markLoginExpired());
  const expired = await screen.findByRole('dialog', { name: '会话已过期' });
  fireEvent.change(within(expired).getByLabelText('账号'), { target: { value: 'demo@playground.invalid' } });
  fireEvent.change(within(expired).getByLabelText('密码'), { target: { value: 'demo-only' } });
  fireEvent.click(within(expired).getByRole('button', { name: '登录' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '会话已过期' })).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: '名称' })).toBe(input);
  expect(input).toHaveValue('Preserved input');
  expect(f.runtime.stores.interaction.getSnapshot().dirty).toBe(true);
  await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled());
  await confirmSave();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await f.rows('Preserved input')).toHaveLength(1);
});
it('recovers an expired write once through GET and requires explicit confirmation before sending again', async () => {
  const f = await fixture('roles');
  fireEvent.click(await screen.findByRole('button', { name: '新增角色' }));
  await fill('roles', 'Reconfirmed input');
  f.expire();
  await confirmSave();
  expect(await screen.findByRole('alert')).toHaveTextContent('重新确认');
  const posts = () => f.calls.filter(call => call.path === '/api/system/roles' && call.method === 'POST');
  expect(posts()).toHaveLength(1);
  expect(posts()[0].status).toBe(401);
  expect(f.calls.filter(call => call.path === '/api/auth/refresh')).toHaveLength(1);
  expect(await f.rows('Reconfirmed input')).toHaveLength(0);
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '确认保存' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(posts().map(call => call.status)).toEqual([401, 200]);
  expect(await f.rows('Reconfirmed input')).toHaveLength(1);
});
