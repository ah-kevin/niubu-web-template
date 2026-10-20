import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createAppStores, createAuthSession } from '@niubu/stores';
import { createPreferenceManager } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks/storage';
import type { AuthContext } from '@niubu/types';
import type { RequestOutcome } from '@niubu/request';
import { StarterProviders } from '../app/providers';
import { appDefaults, appIdentity, appPolicy } from '../app/config';
import { createStarterI18n } from '../locales';
import type { LoginInput, StarterUser } from '../auth/schemas';
import type { StarterApi } from '../api';
import type { RecordByResource, ResourceKind, SystemCrudPort, SystemTreePort, SystemTreeSnapshot, TreeResource } from './contracts';
import { ResourcePage } from './ResourcePage';
import { parseSystemRecord } from './schemas';
import { ownerScopeKey, resourceDraftKey } from './resource-config';

const north = { kind: 'workspace', id: 'north' } as const;
const kinds = ['users', 'roles', 'menus', 'departments'] as const;
const titles = { users: '用户管理', roles: '角色管理', menus: '菜单管理', departments: '部门管理' };
const createLabels = { users: '新增用户', roles: '新增角色', menus: '新增菜单', departments: '新增部门' };
const listTitles = { users: '用户列表', roles: '角色列表', menus: null, departments: '部门列表' };
const rows: { [K in ResourceKind]: RecordByResource[K][] } = {
  users: Array.from({ length: 12 }, (_, i) => ({
    id: `users-${i + 1}`,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.test`,
    roleId: 'roles-1',
    departmentId: 'departments-1',
    enabled: true,
  })),
  roles: [{ id: 'roles-1', name: 'Operator', code: 'operator', description: 'Example role', enabled: true }],
  menus: [{ id: 'menus-1', title: 'Group', kind: 'group', parentId: null, order: 0, enabled: true }],
  departments: [{ id: 'departments-1', name: 'Head office', code: 'head', parentId: null, enabled: true }],
};
const treeRows: { menus: RecordByResource['menus'][]; departments: RecordByResource['departments'][] } = {
  menus: [
    { id: 'menus-1', title: 'Group', kind: 'group', parentId: null, order: 0, enabled: true },
    { id: 'menus-branch', title: 'Branch', kind: 'group', parentId: 'menus-1', order: 1, enabled: true },
    { id: 'menus-leaf', title: 'Deep page', kind: 'page', pageId: 'starter.home', parentId: 'menus-branch', order: 2, enabled: true },
  ],
  departments: [
    { id: 'departments-1', name: 'Head office', code: 'head', parentId: null, enabled: true },
    { id: 'departments-branch', name: 'Branch', code: 'branch', parentId: 'departments-1', enabled: true },
    { id: 'departments-leaf', name: 'Deep team', code: 'deep-team', parentId: 'departments-branch', enabled: true },
  ],
};
function treeFixture(kind: TreeResource) { return kind === 'menus' ? { menus: treeRows.menus } : { departments: treeRows.departments }; }
function treeNames(kind: TreeResource) { return { root: kind === 'menus' ? 'Group' : 'Head office', leaf: kind === 'menus' ? 'Deep page' : 'Deep team' }; }
const disposers: (() => void)[] = [];
afterEach(() => {
  cleanup();
  disposers
    .splice(0)
    .reverse()
    .forEach(dispose => dispose());
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

function stubPort<K extends ResourceKind>(kind: K, records: readonly RecordByResource[K][] = rows[kind]) {
  return {
    list: vi.fn<SystemCrudPort<K>['list']>(async (_context, query) => {
      const all = records.filter(
        row => !query.keyword || ('name' in row ? row.name : row.title).includes(query.keyword),
      );
      return {
        ok: true,
        data: {
          rows: all.slice(query.pageIndex * query.pageSize, (query.pageIndex + 1) * query.pageSize),
          rowCount: all.length,
        },
      };
    }),
    get: vi.fn<SystemCrudPort<K>['get']>(async (_context, id) => ({ ok: true, data: records.find(row => row.id === id)! })),
    create: vi.fn<SystemCrudPort<K>['create']>(async (_context, input) => ({
      ok: true,
      data: { ...input, id: `${kind}-new` } as RecordByResource[K],
    })),
    update: vi.fn<SystemCrudPort<K>['update']>(async (_context, id, input) => ({
      ok: true,
      data: { ...input, id } as RecordByResource[K],
    })),
    remove: vi.fn<SystemCrudPort<K>['remove']>(async (_context, id) => ({ ok: true, data: { id } })),
  };
}
function stubTreePort<K extends TreeResource>(kind: K, initial: readonly RecordByResource[K][] = rows[kind]) {
  let records: RecordByResource[K][] = [...initial];
  let sequence = 0;
  return {
    ...stubPort(kind, initial),
    tree: vi.fn<SystemTreePort<K>['tree']>(async () => ({ ok: true as const, data: { rows: records, rowCount: records.length, complete: true as const } })),
    get: vi.fn<SystemCrudPort<K>['get']>(async (_context, id) => ({ ok: true, data: records.find(row => row.id === id)! })),
    create: vi.fn<SystemCrudPort<K>['create']>(async (_context, input) => {
      const record = parseSystemRecord(kind, { ...input, id: `${kind}-new-${++sequence}` });
      records = [...records, record];
      return { ok: true, data: record };
    }),
    update: vi.fn<SystemCrudPort<K>['update']>(async (_context, id, input) => {
      const record = parseSystemRecord(kind, { ...input, id });
      records = records.map(row => row.id === id ? record : row);
      return { ok: true, data: record };
    }),
    remove: vi.fn<SystemCrudPort<K>['remove']>(async (_context, id) => { records = records.filter(row => row.id !== id); return { ok: true, data: { id } }; }),
  };
}

function tableResizeObserver() {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    const observers = new Set<ResizeObserverHarness>();
    class ResizeObserverHarness implements ResizeObserver {
      readonly targets = new Set<Element>();
      readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observers.add(this);
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
      disconnect() {
        this.targets.clear();
        observers.delete(this);
      }
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverHarness);
      const resize = (table: HTMLElement, width: number) =>
        act(() => {
          for (const observer of observers) {
            for (const target of observer.targets) {
              if (!target.contains(table)) continue;
              const size = [{ inlineSize: width, blockSize: 500 }];
              observer.callback(
                [
                  {
                    target,
                    contentRect: new DOMRect(0, 0, width, 500),
                    contentBoxSize: size,
                    borderBoxSize: size,
                    devicePixelContentBoxSize: size,
                  },
                ],
                observer,
              );
            }
          }
        });
  return {
    resize,
    targets: () => [...observers].flatMap(observer => [...observer.targets]),
    restore: () => vi.stubGlobal('ResizeObserver', OriginalResizeObserver),
  };
}

async function mount(kind: ResourceKind, writable = true, fixtures: Partial<typeof rows> = {}) {
  const user: StarterUser = { id: 'ui-owner', name: 'UI owner', roles: [], workspaces: [north] };
  let grants = kinds.flatMap(resource => [
    `system:${resource}:read`,
    ...(writable ? [`system:${resource}:write`] : []),
  ]);
  const auth = createAuthSession<StarterUser, LoginInput>({
    adapter: {
      restore: async () => user,
      login: async () => user,
      logout: async () => {},
      refresh: async () => {},
      getCodes: async () => grants,
      getMenu: async () => [],
      credentialsProvider: () => ({ credentials: 'omit' }),
      invalidateLocal() {},
    },
    onIdentityReset() {},
    onScopeReset() {},
    reload() {},
    homeHref: '/home',
    loginHref: '/login',
  });
  await auth.restore();
  await auth.switchScope(north);
  const stores = createAppStores({ identityKey: user.id, readContext: null });
  const preferences = createPreferenceManager({
    identity: { ...appIdentity, identityKey: user.id },
    appDefaults,
    policy: appPolicy,
    storage: createStoragePort({ getItem: () => null, setItem: () => {} }),
  });
  const i18n = createStarterI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  await i18n.changeLocale(i18n.getSnapshot().preferredLocale, i18n.requiredNamespaces);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const system = {
    users: stubPort('users', fixtures.users),
    roles: stubPort('roles', fixtures.roles),
    menus: stubTreePort('menus', fixtures.menus),
    departments: stubTreePort('departments', fixtures.departments),
  };
  const getContext = (): AuthContext | null => {
    const s = auth.getSnapshot();
    return s.user && s.status === 'ready' && !s.loginExpired
      ? { identityKey: s.user.id, scope: s.scope, generation: s.generation }
      : null;
  };
  const api: StarterApi = {
    system,
    getContext,
    health: async () => ({ ok: true, data: { status: 'ok' } }),
    menu: async () => ({ ok: true, data: [] }),
  };
  const view = render(
    <StarterProviders
      stores={stores}
      preferences={preferences}
      i18n={i18n}
      queryClient={queryClient}
      api={api}
      auth={auth}
      onUnmount={() => {}}
    >
      <ResourcePage resource={kind} />
    </StarterProviders>,
  );
  disposers.push(() => {
    queryClient.clear();
    i18n.dispose();
    preferences.dispose();
    stores.dispose();
    auth.dispose();
  });
  await screen.findByRole('heading', { name: titles[kind] });
  await waitFor(() => expect(kind === 'menus' || kind === 'departments' ? system[kind].tree : system[kind].list).toHaveBeenCalled());
  return {
    system,
    auth,
    stores,
    queryClient,
    view,
    setGrants: (value: string[]) => {
      grants = value;
    },
  };
}
async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}
async function fill(kind: ResourceKind, name = 'New record') {
  fireEvent.change(screen.getByRole('textbox', { name: kind === 'menus' ? '标题' : '名称' }), {
    target: { value: name },
  });
  if (kind === 'users') {
    fireEvent.change(screen.getByRole('textbox', { name: '邮箱' }), { target: { value: 'new@example.test' } });
    await choose('角色', 'Operator');
    await choose('部门', 'Head office');
  } else if (kind !== 'menus')
    fireEvent.change(screen.getByRole('textbox', { name: '编码' }), { target: { value: 'new_record' } });
}
async function confirmSave() {
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  const review = await screen.findByRole('alertdialog');
  fireEvent.click(within(review).getByRole('button', { name: '确认保存' }));
}

describe('system UI with controlled API ports (not backend persistence)', () => {
  describe.each(['menus', 'departments'] as const)('%s complete tree UI', kind => {
    it('distinguishes an empty complete snapshot from an empty filtered result', async () => {
      await mount(kind, true, kind === 'menus' ? { menus: [] } : { departments: [] });
      expect(await screen.findByText('暂无来源记录')).toBeInTheDocument();
      expect(screen.queryByText('来源总数未知')).not.toBeInTheDocument();
    });
    it('reports a filtered empty result from a nonempty complete snapshot', async () => {
      await mount(kind, true, treeFixture(kind));
      await userEvent.click(screen.getByRole('button', { name: '搜索', pressed: false }));
      await userEvent.type(screen.getByRole('textbox', { name: '关键词' }), 'no-such-node');
      await userEvent.click(screen.getByRole('button', { name: '查询' }));
      expect(await screen.findByText('没有匹配记录')).toBeInTheDocument();
      expect(screen.queryByText('来源总数未知')).not.toBeInTheDocument();
    });
    it('loads only the complete snapshot and offers no pagination', async () => {
      const f = await mount(kind, true, treeFixture(kind));
      await screen.findByRole('button', { name: `查看 ${treeNames(kind).root}` });
      expect(f.system[kind].tree).toHaveBeenCalled();
      expect(f.system[kind].list).not.toHaveBeenCalled();
      expect(screen.queryByRole('navigation', { name: titles[kind] })).not.toBeInTheDocument();
    });
    it('starts collapsed and reveals each level only through its disclosure', async () => {
      await mount(kind, true, treeFixture(kind));
      const names = treeNames(kind);
      const expand = await screen.findByRole('button', { name: `展开 ${names.root}` });
      expect(screen.queryByRole('button', { name: '查看 Branch' })).not.toBeInTheDocument();
      await userEvent.click(expand);
      expect(screen.getByRole('button', { name: `收起 ${names.root}` })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: '查看 Branch' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `查看 ${names.leaf}` })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '展开 Branch' }));
      expect(screen.getByRole('button', { name: `查看 ${names.leaf}` })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `展开 ${names.leaf}` })).not.toBeInTheDocument();
      if (kind === 'menus') expect(screen.queryByRole('button', { name: `新增下级 ${names.leaf}` })).not.toBeInTheDocument();
      else expect(screen.getByRole('button', { name: `新增下级 ${names.leaf}` })).toBeEnabled();
    });
    it('does not expand by row or row-action clicks', async () => {
      await mount(kind, true, treeFixture(kind));
      const { root } = treeNames(kind);
      await screen.findByRole('button', { name: `展开 ${root}` });
      fireEvent.click(within(screen.getByRole('row', { name: new RegExp(root) })).getAllByRole('cell')[0]!);
      expect(screen.queryByRole('button', { name: '查看 Branch' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: `查看 ${root}` }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '关闭' }));
      expect(screen.getByRole('button', { name: `展开 ${root}` })).toHaveAttribute('aria-expanded', 'false');
    });
    it('keeps matching descendants with their ancestors and allows the user to collapse the query path', async () => {
      await mount(kind, true, treeFixture(kind));
      await userEvent.click(screen.getByRole('button', { name: '搜索', pressed: false }));
      await userEvent.type(screen.getByRole('textbox', { name: '关键词' }), treeNames(kind).leaf);
      await userEvent.click(screen.getByRole('button', { name: '查询' }));
      expect(await screen.findByRole('button', { name: `查看 ${treeNames(kind).leaf}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `查看 ${treeNames(kind).root}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '查看 Branch' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: `收起 ${treeNames(kind).root}` }));
      expect(screen.queryByRole('button', { name: `查看 ${treeNames(kind).leaf}` })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '刷新' }));
      expect(await screen.findByRole('button', { name: `展开 ${treeNames(kind).root}` })).toBeInTheDocument();
    });
    it('blocks deletion of a parent using the full forest even when its children are filtered out', async () => {
      await mount(kind, true, treeFixture(kind));
      await userEvent.click(screen.getByRole('button', { name: '搜索', pressed: false }));
      await userEvent.type(screen.getByRole('textbox', { name: '关键词' }), treeNames(kind).root);
      await userEvent.click(screen.getByRole('button', { name: '查询' }));
      expect(await screen.findByRole('button', { name: `删除 ${treeNames(kind).root}` })).toBeDisabled();
    });
    it('saves a child, expands its ancestors, refreshes parent choices and focuses the new row', async () => {
      const f = await mount(kind, true, treeFixture(kind));
      const treeBefore = f.system[kind].tree.mock.calls.length;
      await userEvent.click(await screen.findByRole('button', { name: `新增下级 ${treeNames(kind).root}` }));
      await fill(kind, 'Created child');
      await confirmSave();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const view = await screen.findByRole('button', { name: '查看 Created child' });
      expect(f.system[kind].create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ parentId: `${kind}-1` }), expect.any(AbortSignal));
      await waitFor(() => expect(view).toHaveFocus());
      expect(f.system[kind].tree.mock.calls.length).toBeGreaterThan(treeBefore + 1);
      await userEvent.click(screen.getByRole('button', { name: `新增下级 ${treeNames(kind).root}` }));
      await userEvent.click(screen.getByRole('combobox', { name: '父项' }));
      expect(await screen.findByRole('option', { name: /Created child/ })).toBeInTheDocument();
    });
    it('keeps child drafts separate for each parent and for root creation', async () => {
      await mount(kind, true, treeFixture(kind));
      await userEvent.click(await screen.findByRole('button', { name: `新增下级 ${treeNames(kind).root}` }));
      await fill(kind, 'Parent-specific draft');
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
      await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '保留草稿并离开' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: `展开 ${treeNames(kind).root}` }));
      await userEvent.click(screen.getByRole('button', { name: '新增下级 Branch' }));
      expect(screen.queryByRole('button', { name: '恢复草稿' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: kind === 'menus' ? '标题' : '名称' })).toHaveValue('');
      expect(screen.getByRole('combobox', { name: '父项' })).toHaveTextContent('Branch');
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
      await userEvent.click(screen.getByRole('button', { name: createLabels[kind] }));
      expect(screen.queryByRole('button', { name: '恢复草稿' })).not.toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: '父项' })).toHaveTextContent('无父项');
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
      await userEvent.click(screen.getByRole('button', { name: `新增下级 ${treeNames(kind).root}` }));
      await userEvent.click(await screen.findByRole('button', { name: '恢复草稿' }));
      expect(screen.getByRole('textbox', { name: kind === 'menus' ? '标题' : '名称' })).toHaveValue('Parent-specific draft');
      expect(screen.getByRole('combobox', { name: '父项' })).toHaveTextContent(treeNames(kind).root);
    });
    it('excludes self and descendants from parent options and reveals a node moved to the root', async () => {
      const f = await mount(kind, true, treeFixture(kind));
      await userEvent.click(await screen.findByRole('button', { name: `编辑 ${treeNames(kind).root}` }));
      await userEvent.click(screen.getByRole('combobox', { name: '父项' }));
      expect(screen.queryByRole('option', { name: 'Branch' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: treeNames(kind).leaf })).not.toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
      await userEvent.click(screen.getByRole('button', { name: `展开 ${treeNames(kind).root}` }));
      await userEvent.click(screen.getByRole('button', { name: '编辑 Branch' }));
      await choose('父项', '无父项');
      await confirmSave();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(await screen.findByRole('button', { name: '查看 Branch' })).toBeInTheDocument();
      expect(f.system[kind].update).toHaveBeenCalledWith(expect.anything(), `${kind}-branch`, expect.objectContaining({ parentId: null }), expect.any(AbortSignal));
      expect(screen.getByRole('button', { name: `删除 ${treeNames(kind).root}` })).toBeEnabled();
    });
    it('keeps a cancelled snapshot response from replacing a newer tree read', async () => {
      const f = await mount(kind, true, treeFixture(kind));
      let resolve!: (outcome: RequestOutcome<SystemTreeSnapshot<never>>) => void;
      const pending = new Promise<RequestOutcome<SystemTreeSnapshot<never>>>(release => { resolve = release; });
      const port = f.system[kind];
      port.tree.mockImplementationOnce(() => pending);
      await userEvent.click(screen.getByRole('button', { name: '刷新' }));
      await waitFor(() => expect(port.tree.mock.calls.at(-1)?.[1]).toBeDefined());
      const signal = port.tree.mock.calls.at(-1)![1]!;
      await userEvent.click(screen.getByRole('button', { name: '搜索', pressed: false }));
      await userEvent.type(screen.getByRole('textbox', { name: '关键词' }), treeNames(kind).root);
      await userEvent.click(screen.getByRole('button', { name: '查询' }));
      expect(signal.aborted).toBe(true);
      await screen.findByRole('button', { name: `查看 ${treeNames(kind).root}` });
      await act(async () => resolve({ ok: true, data: { rows: [], rowCount: 0, complete: true } }));
      expect(screen.getByRole('button', { name: `查看 ${treeNames(kind).root}` })).toBeInTheDocument();
      expect(screen.queryByText('暂无来源记录')).not.toBeInTheDocument();
    });
    it('retries a failed tree lookup without replacing a live view trigger', async () => {
      const f = await mount(kind, true, treeFixture(kind));
      const port = f.system[kind];
      const trigger = await screen.findByRole('button', { name: `查看 ${treeNames(kind).root}` });
      port.tree.mockResolvedValueOnce({ ok: false, error: { kind: 'transport', details: new Error('offline') } });
      await act(async () => f.queryClient.invalidateQueries({ predicate: query => query.queryKey.at(-1) === 'tree' }));
      await screen.findByText('引用数据加载失败，请重试。');
      expect(screen.getByRole('button', { name: `编辑 ${treeNames(kind).root}` })).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
      await waitFor(() => expect(screen.queryByText('引用数据加载失败，请重试。')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: `查看 ${treeNames(kind).root}` })).toBe(trigger);
      expect(screen.getByRole('button', { name: `编辑 ${treeNames(kind).root}` })).toBeEnabled();
      await userEvent.click(trigger);
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '关闭' }));
      expect(trigger).toHaveFocus();
    });
    it('does not accept a snapshot from a retired login generation', async () => {
      const f = await mount(kind, true, treeFixture(kind));
      const port = f.system[kind];
      let resolve!: (outcome: RequestOutcome<SystemTreeSnapshot<never>>) => void;
      const pending = new Promise<RequestOutcome<SystemTreeSnapshot<never>>>(release => { resolve = release; });
      port.tree.mockImplementationOnce(() => pending);
      await userEvent.click(screen.getByRole('button', { name: '刷新' }));
      const signal = port.tree.mock.calls.at(-1)![1]!;
      act(() => f.auth.markLoginExpired());
      await act(async () => { await f.auth.login({ username: '', password: '' }, `/system/${kind}`); });
      expect(signal.aborted).toBe(true);
      await screen.findByRole('button', { name: `查看 ${treeNames(kind).root}` });
      await act(async () => resolve({ ok: true, data: { rows: [], rowCount: 0, complete: true } }));
      expect(screen.getByRole('button', { name: `查看 ${treeNames(kind).root}` })).toBeInTheDocument();
      expect(screen.queryByText('暂无来源记录')).not.toBeInTheDocument();
    });
    it('deletes a leaf and returns focus to the surviving parent row', async () => {
      const f = await mount(kind, true, treeFixture(kind));
      await userEvent.click(await screen.findByRole('button', { name: `展开 ${treeNames(kind).root}` }));
      await userEvent.click(screen.getByRole('button', { name: '展开 Branch' }));
      await userEvent.click(screen.getByRole('button', { name: `删除 ${treeNames(kind).leaf}` }));
      await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '确定' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: `查看 ${treeNames(kind).leaf}` })).not.toBeInTheDocument());
      expect(f.system[kind].remove).toHaveBeenCalledWith(expect.anything(), `${kind}-leaf`, expect.any(AbortSignal));
      await waitFor(() => expect(screen.getByRole('button', { name: '查看 Branch' })).toHaveFocus());
      expect(screen.getByRole('button', { name: '删除 Branch' })).toBeEnabled();
    });
    it('prefills the parent when creating a child without mutating the tree before confirmation', async () => {
      const f = await mount(kind, true, treeFixture(kind));
      await userEvent.click(await screen.findByRole('button', { name: `新增下级 ${treeNames(kind).root}` }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('combobox', { name: '父项' })).toHaveTextContent(treeNames(kind).root);
      expect(f.system[kind].create).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(f.system[kind].create).not.toHaveBeenCalled();
    });
  });

  it('orders menu siblings by their explicit order while retaining stable ties', async () => {
    await mount('menus', true, { menus: [
      ...treeRows.menus,
      { id: 'early', title: 'Early', kind: 'group', parentId: 'menus-1', order: 0, enabled: true },
      { id: 'tie', title: 'Tie', kind: 'group', parentId: 'menus-1', order: 1, enabled: true },
    ] });
    await userEvent.click(await screen.findByRole('button', { name: '展开 Group' }));
    expect(screen.getAllByRole('row').slice(1).map(row => row.getAttribute('data-row-id'))).toEqual(['menus-1', 'early', 'menus-branch', 'tie']);
  });

  it.each(kinds)('%s places its resource actions in the table toolbar and retains the accessible page name', async kind => {
    await mount(kind);
    const toolbar = within(screen.getByRole('toolbar', { name: titles[kind] }));
    expect(screen.getByRole('heading', { level: 1, name: titles[kind] })).toBeInTheDocument();
    expect(toolbar.getByRole('button', { name: createLabels[kind] })).toBeInTheDocument();
    if (listTitles[kind]) expect(toolbar.getByText(listTitles[kind]!)).toBeInTheDocument();
    else expect(toolbar.queryByText(titles[kind])).not.toBeInTheDocument();
    expect(toolbar.getByRole('button', { name: '刷新' })).toBeInTheDocument();
    expect(toolbar.getByRole('button', { name: '全屏' })).toBeInTheDocument();
    const visible = kind === 'users' || kind === 'roles';
    expect(toolbar.getByRole('button', { name: '搜索', pressed: visible })).toBeInTheDocument();
    const keyword = screen.getByLabelText('关键词');
    expect(screen.queryByRole('textbox', { name: '关键词' })).toBe(visible ? keyword : null);
    if (!visible) await userEvent.click(toolbar.getByRole('button', { name: '搜索' }));
    const buttons = within(keyword.closest('form')!).getAllByRole('button');
    expect(buttons.map(button => button.textContent)).toEqual(['重置', '查询']);
  });

  it('keeps a hidden query draft in the same form while toolbar refresh reloads the applied criteria', async () => {
    const f = await mount('roles');
    const toolbar = within(screen.getByRole('toolbar', { name: '角色管理' }));
    const keyword = screen.getByRole('textbox', { name: '关键词' });
    await userEvent.type(keyword, 'Operator');
    await userEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(f.system.roles.list).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ keyword: 'Operator' }), expect.any(AbortSignal)));
    await userEvent.clear(keyword);
    await userEvent.type(keyword, 'Unapplied draft');
    await userEvent.click(toolbar.getByRole('button', { name: '搜索', pressed: true }));
    expect(screen.queryByRole('textbox', { name: '关键词' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('关键词')).toBe(keyword);
    expect(keyword).toHaveValue('Unapplied draft');
    let release!: (outcome: Awaited<ReturnType<typeof f.system.roles.list>>) => void;
    f.system.roles.list.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const refresh = toolbar.getByRole('button', { name: '刷新' });
    const beforeRefresh = f.system.roles.list.mock.calls.length;
    await userEvent.click(refresh);
    await waitFor(() => expect(f.system.roles.list).toHaveBeenCalledTimes(beforeRefresh + 1));
    expect(refresh).toHaveAttribute('aria-busy', 'true');
    expect(refresh).toHaveAttribute('aria-disabled', 'true');
    expect(refresh).toBeEnabled();
    expect(refresh).toHaveFocus();
    await userEvent.click(refresh);
    expect(f.system.roles.list).toHaveBeenCalledTimes(beforeRefresh + 1);
    await act(async () => release({ ok: true, data: { rows: rows.roles, rowCount: 1 } }));
    await waitFor(() => expect(refresh).not.toHaveAttribute('aria-busy', 'true'));
    expect(toolbar.getByRole('button', { name: '刷新' })).toBe(refresh);
    expect(refresh).toHaveFocus();
    await waitFor(() => expect(f.system.roles.list).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ keyword: 'Operator', pageIndex: 0, pageSize: 10 }), expect.any(AbortSignal)));
    await userEvent.click(toolbar.getByRole('button', { name: '搜索', pressed: false }));
    expect(screen.getByRole('textbox', { name: '关键词' })).toBe(keyword);
    expect(keyword).toHaveValue('Unapplied draft');
  });

  it.each(kinds)('%s keeps refresh available to readonly users while omitting create', async kind => {
    const f = await mount(kind, false);
    const toolbar = within(screen.getByRole('toolbar', { name: titles[kind] }));
    expect(screen.queryByRole('button', { name: createLabels[kind] })).not.toBeInTheDocument();
    const read = kind === 'menus' || kind === 'departments' ? f.system[kind].tree : f.system[kind].list;
    const before = read.mock.calls.length;
    await userEvent.click(toolbar.getByRole('button', { name: '刷新' }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(before + 1));
    if (kind === 'menus' || kind === 'departments') expect(f.system[kind].tree).toHaveBeenLastCalledWith(expect.anything(), expect.any(AbortSignal));
    else expect(f.system[kind].list).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ pageIndex: 0, pageSize: 10 }), expect.any(AbortSignal));
  });

  it('shows the existing role description as a real table column', async () => {
    await mount('roles');
    expect(screen.getByRole('columnheader', { name: /说明/ })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Example role' })).toBeInTheDocument();
  });

  it.each(['查看', '编辑'] as const)(
    'keeps the same %s row trigger during a pending read and restores its focus after closing',
    async actionLabel => {
      const f = await mount('roles');
      let release!: (outcome: RequestOutcome<RecordByResource['roles']>) => void;
      f.system.roles.get.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            release = resolve;
          }),
      );
      const trigger = await screen.findByRole('button', { name: `${actionLabel} Operator` });
      await userEvent.click(trigger);
      expect(f.system.roles.get).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: `${actionLabel} Operator` })).toBe(trigger);
      expect(trigger.isConnected).toBe(true);
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-busy', 'true');
      expect(trigger).toHaveTextContent(actionLabel);

      await act(async () => release({ ok: true, data: rows.roles[0]! }));
      const panel = await screen.findByRole('dialog');
      if (actionLabel === '查看') expect(within(panel).getByText('Operator', { selector: 'dd' })).toBeVisible();
      else expect(within(panel).getByRole('textbox', { name: '名称' })).toHaveValue('Operator');
      expect(trigger.isConnected).toBe(true);

      await userEvent.click(within(panel).getByRole('button', { name: '关闭' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: `${actionLabel} Operator` })).toBe(trigger);
      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );

  it('moves busy feedback to the newest row action and keeps stale replies from clearing it', async () => {
    const f = await mount('roles');
    const requests: { signal: AbortSignal; resolve: (outcome: RequestOutcome<RecordByResource['roles']>) => void }[] = [];
    f.system.roles.get.mockImplementation((_context, _id, signal) => {
      if (!signal) throw new Error('Expected an action abort signal');
      return new Promise(resolve => requests.push({ signal, resolve }));
    });
    const view = await screen.findByRole('button', { name: '查看 Operator' });
    const edit = screen.getByRole('button', { name: '编辑 Operator' });
    const viewText = view.textContent, editText = edit.textContent;
    await userEvent.click(view);
    expect(view).toHaveAttribute('aria-busy', 'true');
    expect(view.textContent).toBe(viewText);
    expect(edit).not.toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('请求中');
    await userEvent.click(edit);
    expect(requests[0]!.signal.aborted).toBe(true);
    expect(view).not.toHaveAttribute('aria-busy', 'true');
    expect(edit).toHaveAttribute('aria-busy', 'true');
    await act(async () => requests[0]!.resolve({ ok: true, data: rows.roles[0]! }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(edit).toHaveAttribute('aria-busy', 'true');
    await act(async () => requests[1]!.resolve({ ok: false, error: { kind: 'http', status: 403 } }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(edit).not.toHaveAttribute('aria-busy', 'true');
    expect(edit.textContent).toBe(editText);
    expect(screen.getByRole('button', { name: '编辑 Operator' })).toBe(edit);
    expect(edit).toHaveFocus();
    expect(screen.queryByText('请求中')).not.toBeInTheDocument();
  });

  it('keeps delete feedback in the same trigger through confirmation cancellation and a failed write', async () => {
    const f = await mount('roles');
    const trigger = await screen.findByRole('button', { name: '删除 Operator' });
    const text = trigger.textContent;
    await userEvent.click(trigger);
    const cancelled = await screen.findByRole('alertdialog');
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(within(cancelled).getByRole('button', { name: '取消' }));
    await waitFor(() => expect(trigger).not.toHaveAttribute('aria-busy', 'true'));
    expect(f.system.roles.remove).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
    let release!: (outcome: RequestOutcome<{ id: string }>) => void;
    f.system.roles.remove.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await userEvent.click(trigger);
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '确定' }));
    await waitFor(() => expect(f.system.roles.remove).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: '删除 Operator' })).toBe(trigger);
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(trigger.textContent).toBe(text);
    await act(async () => release({ ok: false, error: { kind: 'http', status: 409 } }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(trigger).not.toHaveAttribute('aria-busy', 'true');
    expect(trigger.textContent).toBe(text);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('returns successful system pagination focus to the current page after its old trigger was removed', async () => {
    const f = await mount('users');
    let release!: (outcome: Awaited<ReturnType<typeof f.system.users.list>>) => void;
    f.system.users.list.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await userEvent.click(await screen.findByRole('button', { name: '下一页' }));
    await waitFor(() => expect(f.system.users.list).toHaveBeenCalledTimes(2));
    await act(async () => release({ ok: true, data: { rows: rows.users.slice(10), rowCount: 12 } }));
    const currentPage = await screen.findByRole('button', { name: '第 2 页' });
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
    await waitFor(() => expect(currentPage).toHaveFocus());
  });

  it('recovers pagination focus to retry after a failed system page without stealing query focus', async () => {
    const f = await mount('users');
    let reject!: (error: Error) => void;
    f.system.users.list.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    await userEvent.click(await screen.findByRole('button', { name: '下一页' }));
    await waitFor(() => expect(f.system.users.list).toHaveBeenCalledTimes(2));
    await act(async () => reject(new Error('Page failed')));
    const retry = await screen.findByRole('button', { name: '重新加载' });
    await waitFor(() => expect(retry).toHaveFocus());
    await userEvent.click(retry);
    const previous = await screen.findByRole('button', { name: '上一页' });
    f.system.users.list.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    await userEvent.click(previous);
    await waitFor(() => expect(f.system.users.list).toHaveBeenCalledTimes(4));
    const query = screen.getByRole('textbox', { name: '关键词' });
    await userEvent.click(query);
    await act(async () => reject(new Error('Another failed page')));
    expect(await screen.findByRole('button', { name: '重新加载' })).not.toHaveFocus();
    expect(query).toHaveFocus();
  });

  it('keeps the view trigger through a delayed lookup becoming ready after same-user reauthentication', async () => {
    const f = await mount('users');
    let resolveLookup!: (outcome: Awaited<ReturnType<typeof f.system.roles.list>>) => void;
    f.system.roles.list.mockImplementationOnce(() => new Promise(resolve => { resolveLookup = resolve; }));
    act(() => f.auth.markLoginExpired());
    await act(async () => { await f.auth.login({ username: '', password: '' }, '/system/users'); });
    await waitFor(() => expect(f.system.users.list).toHaveBeenLastCalledWith(expect.objectContaining({ generation: f.auth.getSnapshot().generation }), expect.anything(), expect.any(AbortSignal)));
    const trigger = await screen.findByRole('button', { name: '查看 User 1' });
    const edit = screen.getByRole('button', { name: '编辑 User 1' });
    expect(edit).toBeDisabled();
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await act(async () => resolveLookup({ ok: true, data: { rows: rows.roles, rowCount: rows.roles.length } }));
    await waitFor(() => expect(screen.getByLabelText('编辑 User 1')).toBeEnabled());
    expect(screen.getByLabelText('编辑 User 1')).toBe(edit);
    expect(edit).toBeEnabled();
    await userEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.getByRole('button', { name: '查看 User 1' })).toBe(trigger);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it.each(['menus', 'departments'] as const)('%s retains its original row trigger when narrowed under an open overlay', async kind => {
    const observer = tableResizeObserver();
    try {
      await mount(kind, true, treeFixture(kind));
      const table = await screen.findByRole('table', { name: titles[kind] });
      observer.resize(table, 1206);
      const trigger = screen.getByRole('button', { name: `查看 ${treeNames(kind).root}` });
      await userEvent.click(trigger);
      const dialog = await screen.findByRole('dialog');
      observer.resize(table, 341);
      await userEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
      expect(screen.getByRole('button', { name: `查看 ${treeNames(kind).root}` })).toBe(trigger);
      await waitFor(() => expect(trigger).toHaveFocus());
    } finally {
      observer.restore();
    }
  });

  it('keeps the original row trigger available for overlay focus return after the container narrows', async () => {
    const observer = tableResizeObserver();
    try {
      await mount('roles');
      const table = await screen.findByRole('table', { name: '角色管理' });
      observer.resize(table, 1206);
      const trigger = screen.getByRole('button', { name: '查看 Operator' });
      await userEvent.click(trigger);
      const dialog = await screen.findByRole('dialog');
      observer.resize(table, 375);
      expect(table).toHaveStyle({ width: '976px' });
      await userEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
      const restored = screen.getByRole('button', { name: '查看 Operator' });
      await waitFor(() => expect(restored).toHaveFocus());
      expect(restored).toBe(trigger);
    } finally {
      observer.restore();
    }
  });

  it('fills the available desktop table width while preserving manual column widths after container resize', async () => {
    const observer = tableResizeObserver();
    try {
      const fixture = await mount('roles');
      let table = await screen.findByRole('table', { name: '角色管理' });
      const resize = (width: number) => observer.resize(table, width);
      expect(table).toHaveStyle({ width: '976px' });
      resize(1206);
      expect(table).toHaveStyle({ width: '1204px' });
      expect(screen.getByRole('columnheader', { name: '操作' })).toHaveStyle({ width: '256px' });
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '237px' });
      resize(600);
      expect(table).toHaveStyle({ width: '976px' });
      resize(3000);
      expect(table).toHaveStyle({ width: '2816px' });
      resize(1206);
      fireEvent.keyDown(screen.getByRole('button', { name: '调整 名称 列宽' }), { key: 'ArrowRight' });
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '247px' });
      fireEvent.click(screen.getByRole('button', { name: '排序 名称' }));
      await waitFor(() =>
        expect(fixture.system.roles.list).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({ sortBy: 'name', sortOrder: 'asc' }),
          expect.any(AbortSignal),
        ),
      );
      table = await screen.findByRole('table', { name: '角色管理' });
      resize(1506);
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '247px' });
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveAttribute('aria-sort', 'ascending');
      expect(screen.getByRole('columnheader', { name: /编码/ })).toHaveStyle({ width: '312px' });
      expect(table).toHaveStyle({ width: '1439px' });
      resize(0);
      expect(table).toHaveStyle({ width: '1439px' });
      for (let index = 0; index < 30; index++) {
        fireEvent.keyDown(screen.getByRole('button', { name: '调整 名称 列宽' }), { key: 'ArrowLeft' });
      }
      resize(1206);
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '80px' });
      const measuredTargets = observer.targets().filter(target => target.contains(table));
      fixture.view.unmount();
      expect(observer.targets().some(target => measuredTargets.includes(target))).toBe(false);
    } finally {
      observer.restore();
    }
  });

  it.each(kinds)(
    '%s queries, resets, creates, reads detail, edits and confirms delete through the shared owners',
    async kind => {
      const f = await mount(kind);
      const port = f.system[kind];
      expect(screen.getByText(/重启/)).toHaveTextContent(/固定.*登录/);
      if (kind === 'menus' || kind === 'departments') await userEvent.click(screen.getByRole('button', { name: '搜索', pressed: false }));
      fireEvent.change(screen.getByRole('textbox', { name: '关键词' }), { target: { value: 'missing' } });
      fireEvent.click(screen.getByRole('button', { name: '查询' }));
      if (kind === 'menus' || kind === 'departments') {
        await screen.findByText('没有匹配记录');
        expect(f.system[kind].tree).toHaveBeenLastCalledWith(expect.anything(), expect.any(AbortSignal));
        expect(port.list).not.toHaveBeenCalled();
      } else await waitFor(() =>
        expect(port.list).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({ keyword: 'missing', pageIndex: 0 }),
          expect.any(AbortSignal),
        ),
      );
      fireEvent.click(screen.getByRole('button', { name: '重置' }));
      await waitFor(() => expect(screen.getByRole('textbox', { name: '关键词' })).toHaveValue(''));
      await screen.findByRole('button', {
        name: `查看 ${kind === 'users' ? 'User 1' : kind === 'roles' ? 'Operator' : kind === 'menus' ? 'Group' : 'Head office'}`,
      });
      fireEvent.click(screen.getByRole('button', { name: createLabels[kind] }));
      await fill(kind);
      await confirmSave();
      await waitFor(() => expect(port.create).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const entity =
        kind === 'users' ? 'User 1' : kind === 'roles' ? 'Operator' : kind === 'menus' ? 'Group' : 'Head office';
      fireEvent.click(screen.getByRole('button', { name: `查看 ${entity}` }));
      const detail = await screen.findByRole('dialog');
      expect(await within(detail).findByText(entity, { selector: 'dd' })).toBeVisible();
      expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument();
      fireEvent.click(within(detail).getByRole('button', { name: '关闭' }));
      fireEvent.click(screen.getByRole('button', { name: `编辑 ${entity}` }));
      const label = kind === 'menus' ? '标题' : '名称';
      await waitFor(() => expect(screen.getByRole('textbox', { name: label })).toHaveValue(entity));
      fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value: 'Updated' } });
      await confirmSave();
      await waitFor(() =>
        expect(port.update).toHaveBeenCalledWith(
          expect.anything(),
          `${kind}-1`,
          expect.objectContaining(
            kind === 'menus' ? { title: 'Updated', parentId: null, kind: 'group' } : { name: 'Updated' },
          ),
          expect.any(AbortSignal),
        ),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: `删除 ${kind === 'menus' || kind === 'departments' ? 'Updated' : entity}` }));
      const deletion = await screen.findByRole('alertdialog');
      expect(port.remove).not.toHaveBeenCalled();
      fireEvent.click(within(deletion).getByRole('button', { name: '确定' }));
      await waitFor(() =>
        expect(port.remove).toHaveBeenCalledWith(expect.anything(), `${kind}-1`, expect.any(AbortSignal)),
      );
    },
  );
  it('users loads second page; viewer has no write actions', async () => {
    const f = await mount('users', false);
    await screen.findByRole('cell', { name: 'User 1' });
    expect(screen.queryByRole('button', { name: createLabels.users })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑 User/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByRole('cell', { name: 'User 11' });
    expect(f.system.users.list).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ pageIndex: 1 }),
      expect.any(AbortSignal),
    );
  });
  it('save errors keep review and input; only an explicit second confirmation resends', async () => {
    const f = await mount('roles');
    f.system.roles.create.mockResolvedValueOnce({ ok: false, error: { kind: 'http', status: 409, code: 'CONFLICT' } });
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    await fill('roles');
    await confirmSave();
    await screen.findByRole('alert');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('冲突');
    expect(f.system.roles.create).toHaveBeenCalledTimes(1);
    expect(f.stores.interaction.getSnapshot().dirty).toBe(true);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '返回修改' }));
    expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('New record');
    await confirmSave();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(f.system.roles.create).toHaveBeenCalledTimes(2);
    expect(f.stores.interaction.getSnapshot().dirty).toBe(false);
  });
  it('expired write recovers with the same port GET and waits for reconfirmation without replay', async () => {
    const f = await mount('roles');
    f.system.roles.create.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'http', status: 401, code: 'ACCESS_EXPIRED' },
    });
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    await fill('roles');
    await confirmSave();
    await waitFor(() =>
      expect(f.system.roles.list).toHaveBeenCalledWith(
        expect.anything(),
        { pageIndex: 0, pageSize: 1 },
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('重新确认');
    expect(f.system.roles.create).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '确认保存' }));
    await waitFor(() => expect(f.system.roles.create).toHaveBeenCalledTimes(2));
  });
  it('outer close preserves dirty draft and offers explicit recovery against the real baseline', async () => {
    const f = await mount('roles');
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    await fill('roles', 'Draft name');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '保留草稿并离开' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    expect(await screen.findByRole('button', { name: '恢复草稿' })).toBeVisible();
    expect(screen.queryByRole('textbox', { name: '名称' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '恢复草稿' }));
    expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('Draft name');
    await waitFor(() => expect(f.stores.interaction.getSnapshot().dirty).toBe(true));
  });
  it('late save after cancellation cannot close a newly opened editor', async () => {
    const f = await mount('roles');
    let release!: (outcome: RequestOutcome<RecordByResource['roles']>) => void;
    f.system.roles.create.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    await fill('roles');
    await confirmSave();
    await waitFor(() => expect(f.system.roles.create).toHaveBeenCalledTimes(1));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '返回修改' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '保留草稿并离开' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    fireEvent.click(await screen.findByRole('button', { name: '丢弃草稿' }));
    await fill('roles', 'Current input');
    await act(async () =>
      release({
        ok: true,
        data: { id: 'late', name: 'New record', code: 'new_record', description: '', enabled: true },
      }),
    );
    expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('Current input');
    expect(f.stores.interaction.getSnapshot().dirty).toBe(true);
  });
  it('same-user expiry keeps the same form DOM and dirty input, then submits with a fresh generation', async () => {
    const f = await mount('roles');
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    await fill('roles', 'Retained input');
    const input = screen.getByRole('textbox', { name: '名称' });
    const initialGeneration = f.auth.getSnapshot().generation;
    act(() => f.auth.markLoginExpired());
    expect(screen.getByRole('textbox', { name: '名称' })).toBe(input);
    expect(input).toHaveValue('Retained input');
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    await act(async () => {
      await f.auth.login({ username: '', password: '' }, '/system/roles');
    });
    expect(f.auth.getSnapshot().generation).toBeGreaterThan(initialGeneration);
    expect(screen.getByRole('textbox', { name: '名称' })).toBe(input);
    expect(f.stores.interaction.getSnapshot().dirty).toBe(true);
    await confirmSave();
    await waitFor(() =>
      expect(f.system.roles.create).toHaveBeenCalledWith(
        expect.objectContaining({ generation: f.auth.getSnapshot().generation }),
        expect.objectContaining({ name: 'Retained input' }),
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('same-user lower grants abort an in-flight write without clearing or closing the editor', async () => {
    const f = await mount('roles');
    let release!: (outcome: RequestOutcome<RecordByResource['roles']>) => void;
    f.system.roles.create.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    await fill('roles');
    await confirmSave();
    const input = document.querySelector<HTMLInputElement>('input[name="name"]')!;
    await waitFor(() => expect(f.system.roles.create).toHaveBeenCalledTimes(1));
    const signal = f.system.roles.create.mock.calls[0]![2]!;
    act(() => f.auth.markLoginExpired());
    f.setGrants(['system:roles:read']);
    await act(async () => {
      await f.auth.login({ username: '', password: '' }, '/system/roles');
    });
    expect(signal.aborted).toBe(true);
    await act(async () =>
      release({
        ok: true,
        data: { id: 'late', name: 'New record', code: 'new_record', description: '', enabled: true },
      }),
    );
    expect(screen.getByRole('textbox', { name: '名称' })).toBe(input);
    expect(input).toHaveValue('New record');
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(f.stores.interaction.getSnapshot().dirty).toBe(true);
    expect(f.system.roles.create).toHaveBeenCalledTimes(1);
  });
  it('menu dependencies keep raw hidden values but project only the chosen kind and reject blank numeric order', async () => {
    const f = await mount('menus');
    fireEvent.click(screen.getByRole('button', { name: createLabels.menus }));
    await fill('menus');
    await choose('类型', '外部链接');
    fireEvent.change(screen.getByRole('textbox', { name: '链接地址' }), {
      target: { value: 'https://example.test/path' },
    });
    await choose('类型', '目录');
    expect(screen.queryByRole('textbox', { name: '链接地址' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: '顺序' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await screen.findByText('顺序须为 0–9999 的整数，不可留空。');
    expect(f.system.menus.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('spinbutton', { name: '顺序' }), { target: { value: '3' } });
    await confirmSave();
    await waitFor(() =>
      expect(f.system.menus.create).toHaveBeenCalledWith(
        expect.anything(),
        { title: 'New record', kind: 'group', parentId: null, order: 3, enabled: true },
        expect.any(AbortSignal),
      ),
    );
  });
  it('failed expiry recovery cancels the local review without stacking another alert', async () => {
    const f = await mount('roles');
    f.system.roles.create.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'http', status: 401, code: 'ACCESS_EXPIRED' },
    });
    f.system.roles.list.mockImplementationOnce(async () => {
      f.auth.markLoginExpired();
      return { ok: false, error: { kind: 'aborted' } };
    });
    fireEvent.click(screen.getByRole('button', { name: createLabels.roles }));
    await fill('roles');
    await confirmSave();
    await waitFor(() => expect(f.auth.getSnapshot().loginExpired).toBe(true));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('New record');
  });
  it('reads all lookup pages at size 100 and never substitutes the first reference', async () => {
    const roles = Array.from({ length: 105 }, (_, i) => ({
      id: `roles-${i + 1}`,
      name: `Role ${i + 1}`,
      code: `role_${i + 1}`,
      description: '',
      enabled: true,
    }));
    const f = await mount('users', true, { roles });
    await waitFor(() => expect(screen.getByRole('button', { name: createLabels.users })).toBeEnabled());
    expect(f.system.roles.list).toHaveBeenCalledWith(
      expect.anything(),
      { pageIndex: 1, pageSize: 100 },
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole('button', { name: createLabels.users }));
    expect(screen.getByRole('combobox', { name: '角色' })).toHaveTextContent('请选择');
    await choose('角色', 'Role 105');
    expect(screen.getByRole('combobox', { name: '角色' })).toHaveTextContent('Role 105');
  });
  it('shows disabled and missing references in readonly details and keeps them visible during edit', async () => {
    await mount('users', true, { roles: [{ ...rows.roles[0]!, enabled: false }], departments: [] });
    fireEvent.click(await screen.findByRole('button', { name: '查看 User 1' }));
    const detail = await screen.findByRole('dialog');
    expect(await within(detail).findByText('Operator（已停用）', { selector: 'dd' })).toBeVisible();
    expect(within(detail).getByText('缺失或不可选引用（departments-1）', { selector: 'dd' })).toBeVisible();
    fireEvent.click(within(detail).getByRole('button', { name: '关闭' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑 User 1' }));
    const editor = await screen.findByRole('dialog');
    expect(within(editor).getByRole('combobox', { name: '角色' })).toHaveTextContent('Operator（已停用）');
    expect(within(editor).getByRole('combobox', { name: '部门' })).toHaveTextContent(
      '缺失或不可选引用（departments-1）',
    );
  });
  it('retains raw query edits across same-user reauth but reloads the applied criteria', async () => {
    const f = await mount('users');
    fireEvent.change(screen.getByRole('textbox', { name: '关键词' }), { target: { value: 'User 1' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() =>
      expect(f.system.users.list).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ keyword: 'User 1' }),
        expect.any(AbortSignal),
      ),
    );
    const query = screen.getByRole('textbox', { name: '关键词' });
    fireEvent.change(query, { target: { value: 'Unapplied draft' } });
    act(() => f.auth.markLoginExpired());
    await act(async () => {
      await f.auth.login({ username: '', password: '' }, '/system/users');
    });
    expect(screen.getByRole('textbox', { name: '关键词' })).toBe(query);
    expect(query).toHaveValue('Unapplied draft');
    await waitFor(() =>
      expect(f.system.users.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ generation: f.auth.getSnapshot().generation }),
        expect.objectContaining({ keyword: 'User 1' }),
        expect.any(AbortSignal),
      ),
    );
    expect(f.stores.interaction.getSnapshot().dirty).toBe(false);
  });
  it('late detail after expiry cannot reopen a panel or retain a stale loading status after reauth', async () => {
    const f = await mount('roles');
    let release!: (outcome: RequestOutcome<RecordByResource['roles']>) => void;
    f.system.roles.get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    fireEvent.click(await screen.findByRole('button', { name: '查看 Operator' }));
    await waitFor(() => expect(f.system.roles.get).toHaveBeenCalledTimes(1));
    act(() => f.auth.markLoginExpired());
    await act(async () => {
      await f.auth.login({ username: '', password: '' }, '/system/roles');
    });
    await act(async () => release({ ok: true, data: rows.roles[0]! }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('请求中')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '查看 Operator' })).not.toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: '编辑 Operator' })).not.toHaveAttribute('aria-busy', 'true');
  });
  it('expired delete performs GET recovery and needs a new deletion confirmation', async () => {
    const f = await mount('roles');
    f.system.roles.remove.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'http', status: 401, code: 'ACCESS_EXPIRED' },
    });
    fireEvent.click(await screen.findByRole('button', { name: '删除 Operator' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '确定' }));
    await waitFor(() =>
      expect(f.system.roles.list).toHaveBeenCalledWith(
        expect.anything(),
        { pageIndex: 0, pageSize: 1 },
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('再次点击删除');
    expect(f.system.roles.remove).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '删除 Operator' }));
    expect(f.system.roles.remove).toHaveBeenCalledTimes(1);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '确定' }));
    await waitFor(() => expect(f.system.roles.remove).toHaveBeenCalledTimes(2));
  });
  it('resubmitting the same pending query starts a fresh read instead of reusing the cancelled promise', async () => {
    const f = await mount('roles');
    await screen.findByRole('button', { name: '查看 Operator' });
    const previousCalls = f.system.roles.list.mock.calls.length;
    let release!: (outcome: RequestOutcome<{ rows: readonly RecordByResource['roles'][]; rowCount: number }>) => void;
    f.system.roles.list.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: '关键词' }), { target: { value: 'Operator' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(f.system.roles.list).toHaveBeenCalledTimes(previousCalls + 1));
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(f.system.roles.list).toHaveBeenCalledTimes(previousCalls + 2));
    expect(await screen.findByRole('button', { name: '查看 Operator' })).toBeVisible();
    await act(async () => release({ ok: true, data: { rows: [], rowCount: 0 } }));
    expect(screen.getByRole('button', { name: '查看 Operator' })).toBeVisible();
  });
  it('restores only declared field types against the real record baseline and filters extra draft properties', async () => {
    const f = await mount('roles');
    f.stores.interaction.writeDraft(ownerScopeKey('ui-owner', north), resourceDraftKey('roles', 'roles-1'), {
      name: 'Recovered',
      code: 42,
      enabled: 'false',
      undeclared: 'excluded',
    });
    fireEvent.click(await screen.findByRole('button', { name: '编辑 Operator' }));
    fireEvent.click(await screen.findByRole('button', { name: '恢复草稿' }));
    expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('Recovered');
    expect(screen.getByRole('textbox', { name: '编码' })).toHaveValue('operator');
    expect(screen.getByRole('switch', { name: '启用状态' })).toBeChecked();
    await waitFor(() => expect(f.stores.interaction.getSnapshot().dirty).toBe(true));
    await confirmSave();
    await waitFor(() =>
      expect(f.system.roles.update).toHaveBeenCalledWith(
        expect.anything(),
        'roles-1',
        { name: 'Recovered', code: 'operator', enabled: true, description: 'Example role' },
        expect.any(AbortSignal),
      ),
    );
  });
  it('rejects an unknown menu kind from a restored string draft instead of silently changing it to a group', async () => {
    const f = await mount('menus');
    f.stores.interaction.writeDraft(ownerScopeKey('ui-owner', north), resourceDraftKey('menus'), {
      title: 'Recovered menu',
      kind: 'unknown',
      order: 0,
      parentId: '',
      enabled: true,
    });
    await waitFor(() => expect(screen.getByRole('button', { name: createLabels.menus })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: createLabels.menus }));
    fireEvent.click(await screen.findByRole('button', { name: '恢复草稿' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await screen.findByText('请填写有效内容。');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(f.system.menus.create).not.toHaveBeenCalled();
  });
  it('keeps a removed query reference visibly labelled while retaining the applied filter after reauth', async () => {
    const roles = [...rows.roles];
    const f = await mount('users', true, { roles });
    await choose('角色', 'Operator');
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() =>
      expect(f.system.users.list).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ roleId: 'roles-1' }),
        expect.any(AbortSignal),
      ),
    );
    roles.splice(0);
    act(() => f.auth.markLoginExpired());
    await act(async () => {
      await f.auth.login({ username: '', password: '' }, '/system/users');
    });
    await waitFor(() =>
      expect(f.system.roles.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ generation: f.auth.getSnapshot().generation }),
        { pageIndex: 0, pageSize: 100 },
        expect.any(AbortSignal),
      ),
    );
    expect(screen.getByRole('combobox', { name: '角色' })).toHaveTextContent('缺失或不可选引用（roles-1）');
  });
});


describe('compiled system page composition', () => {
  let rules: import('../tests/compiled-styles').CompiledStyleRule[];
  beforeAll(async () => {
    const { compileStarterStyles, readCompiledRules } = await import('../tests/compiled-styles');
    rules = readCompiledRules(await compileStarterStyles());
  });
  it('keeps the accessible page heading and moves demo guidance into a collapsed disclosure', async () => {
    await mount('users');
    const heading = screen.getByRole('heading', { level: 1, name: '用户管理' });
    expect(heading).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    const notes = screen.getByText('演示说明').closest('details')!;
    expect(notes).not.toHaveAttribute('open');
    await userEvent.click(within(notes).getByText('演示说明'));
    expect(notes).toHaveAttribute('open');
    expect(within(notes).getByText(/重启/)).toHaveTextContent(/固定.*登录/);
  });
  it.each(['standard', 'compact'])('composes query actions independently of the public form footer in %s density', async density => {
    await mount('users');
    const { matchingRules } = await import('../tests/compiled-styles');
    document.documentElement.dataset.density = density;
    document.documentElement.style.fontSize = '22px';
    try {
      const actions = document.querySelector<HTMLElement>('.system-query-actions')!;
      expect(actions).not.toHaveClass('pattern-form-actions');
      expect(matchingRules(rules, actions, 'justify-content').some(rule => rule.style.getPropertyValue('justify-content') === 'flex-end')).toBe(true);
      expect(matchingRules(rules, actions, 'gap').some(rule => rule.style.getPropertyValue('gap').replace(/\s/g, '') === 'calc(var(--spacing)*2)')).toBe(true);
      const form = actions.closest('form')!;
      expect(form.querySelector('.system-query-fields')).not.toBeNull();
      expect(within(actions).getByRole('button', { name: '查询' })).toHaveAttribute('type', 'submit');
      expect(within(actions).getByRole('button', { name: '重置' })).toHaveAttribute('type', 'reset');
    } finally {
      delete document.documentElement.dataset.density;
      document.documentElement.style.removeProperty('font-size');
    }
  });
});
