import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createAppStores, createAuthSession } from '@niubu/stores';
import { createPreferenceManager } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks/storage';
import type { AuthContext } from '@niubu/types';
import type { RequestOutcome } from '@niubu/request';
import { PlaygroundProviders } from '../app/providers';
import { appDefaults, appIdentity, appPolicy } from '../app/config';
import { createPlaygroundI18n } from '../locales';
import type { LoginInput, PlaygroundUser } from '../auth/schemas';
import type { PlaygroundApi } from '../api';
import type { RecordByResource, ResourceKind, SystemPort } from './contracts';
import { ResourcePage } from './ResourcePage';
import { ownerScopeKey, resourceDraftKey } from './resource-config';

const north = { kind: 'workspace', id: 'north' } as const;
const kinds = ['users', 'roles', 'menus', 'departments'] as const;
const titles = { users: '用户管理', roles: '角色管理', menus: '菜单管理', departments: '部门管理' };
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

function stubPort<K extends ResourceKind>(kind: K, records = rows[kind]) {
  return {
    list: vi.fn<SystemPort<K>['list']>(async (_context, query) => {
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
    get: vi.fn<SystemPort<K>['get']>(async (_context, id) => ({ ok: true, data: records.find(row => row.id === id)! })),
    create: vi.fn<SystemPort<K>['create']>(async (_context, input) => ({
      ok: true,
      data: { ...input, id: `${kind}-new` } as RecordByResource[K],
    })),
    update: vi.fn<SystemPort<K>['update']>(async (_context, id, input) => ({
      ok: true,
      data: { ...input, id } as RecordByResource[K],
    })),
    remove: vi.fn<SystemPort<K>['remove']>(async (_context, id) => ({ ok: true, data: { id } })),
  };
}
async function mount(kind: ResourceKind, writable = true, fixtures: Partial<typeof rows> = {}) {
  const user: PlaygroundUser = { id: 'ui-owner', name: 'UI owner', roles: [], workspaces: [north] };
  let grants = kinds.flatMap(resource => [
    `system:${resource}:read`,
    ...(writable ? [`system:${resource}:write`] : []),
  ]);
  const auth = createAuthSession<PlaygroundUser, LoginInput>({
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
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const system = {
    users: stubPort('users', fixtures.users),
    roles: stubPort('roles', fixtures.roles),
    menus: stubPort('menus', fixtures.menus),
    departments: stubPort('departments', fixtures.departments),
  };
  const getContext = (): AuthContext | null => {
    const s = auth.getSnapshot();
    return s.user && s.status === 'ready' && !s.loginExpired
      ? { identityKey: s.user.id, scope: s.scope, generation: s.generation }
      : null;
  };
  const api: PlaygroundApi = {
    transfers: { upload: async () => ({ok:false,error:{kind:'not-enabled'}}), download: async () => ({ok:false,error:{kind:'not-enabled'}}) },
    system,
    getContext,
    health: async () => ({ ok: true, data: { status: 'ok' } }),
    menu: async () => ({ ok: true, data: [] }),
    echo: async () => ({ ok: true, data: { value: '', query: [], headers: {} } }),
  };
  const view = render(
    <PlaygroundProviders
      stores={stores}
      preferences={preferences}
      i18n={i18n}
      queryClient={queryClient}
      api={api}
      auth={auth}
      onUnmount={() => {}}
    >
      <ResourcePage resource={kind} />
    </PlaygroundProviders>,
  );
  disposers.push(() => {
    queryClient.clear();
    i18n.dispose();
    preferences.dispose();
    stores.dispose();
    auth.dispose();
  });
  await screen.findByRole('heading', { name: titles[kind] });
  await waitFor(() => expect(system[kind].list).toHaveBeenCalled());
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

  it('fills the available desktop table width while preserving manual column widths after container resize', async () => {
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
    try {
      const fixture = await mount('roles');
      let table = await screen.findByRole('table', { name: '角色管理' });
      const resize = (width: number) =>
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
      expect(table).toHaveStyle({ width: '796px' });
      resize(1206);
      expect(table).toHaveStyle({ width: '1204px' });
      expect(screen.getByRole('columnheader', { name: '操作' })).toHaveStyle({ width: '256px' });
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '316px' });
      resize(600);
      expect(table).toHaveStyle({ width: '796px' });
      resize(3000);
      expect(table).toHaveStyle({ width: '2176px' });
      resize(1206);
      fireEvent.keyDown(screen.getByRole('button', { name: '调整 名称 列宽' }), { key: 'ArrowRight' });
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '326px' });
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
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '326px' });
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveAttribute('aria-sort', 'ascending');
      expect(screen.getByRole('columnheader', { name: /编码/ })).toHaveStyle({ width: '416px' });
      expect(table).toHaveStyle({ width: '1414px' });
      resize(0);
      expect(table).toHaveStyle({ width: '1414px' });
      for (let index = 0; index < 30; index++) {
        fireEvent.keyDown(screen.getByRole('button', { name: '调整 名称 列宽' }), { key: 'ArrowLeft' });
      }
      resize(1206);
      expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '80px' });
      const measuredTargets = [...observers]
        .flatMap(observer => [...observer.targets])
        .filter(target => target.contains(table));
      fixture.view.unmount();
      expect([...observers].some(observer => measuredTargets.some(target => observer.targets.has(target)))).toBe(false);
    } finally {
      vi.stubGlobal('ResizeObserver', OriginalResizeObserver);
    }
  });

  it.each(kinds)(
    '%s queries, resets, creates, reads detail, edits and confirms delete through the shared owners',
    async kind => {
      const f = await mount(kind);
      const port = f.system[kind];
      expect(screen.getByText(/重启/)).toHaveTextContent(/固定.*登录/);
      fireEvent.change(screen.getByRole('textbox', { name: '关键词' }), { target: { value: 'missing' } });
      fireEvent.click(screen.getByRole('button', { name: '查询' }));
      await waitFor(() =>
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
      fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
      fireEvent.click(screen.getByRole('button', { name: `删除 ${entity}` }));
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
    expect(screen.queryByRole('button', { name: '新增' })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
    await fill('roles', 'Draft name');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '保留草稿并离开' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
    await fill('roles');
    await confirmSave();
    await waitFor(() => expect(f.system.roles.create).toHaveBeenCalledTimes(1));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '返回修改' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '保留草稿并离开' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    await waitFor(() => expect(screen.getByRole('button', { name: '新增' })).toBeEnabled());
    expect(f.system.roles.list).toHaveBeenCalledWith(
      expect.anything(),
      { pageIndex: 1, pageSize: 100 },
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    await waitFor(() => expect(screen.getByRole('button', { name: '新增' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
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
    const { compilePlaygroundStyles, readCompiledRules } = await import('../tests/compiled-styles');
    rules = readCompiledRules(await compilePlaygroundStyles());
  });
  it('uses the shared workspace heading scale and spacing on the resource page', async () => {
    await mount('users');
    const { matchingRules } = await import('../tests/compiled-styles');
    const heading = screen.getByRole('heading', { name: '用户管理' });
    expect(matchingRules(rules, heading, 'font-size').some(rule => rule.style.getPropertyValue('font-size') === 'var(--workspace-title-font-size)')).toBe(true);
    expect(matchingRules(rules, heading, 'margin-bottom').some(rule => rule.style.getPropertyValue('margin-bottom') === 'var(--workspace-heading-gap)')).toBe(true);
    expect(matchingRules(rules, heading, 'font-weight').some(rule => rule.style.getPropertyValue('font-weight') === '650')).toBe(true);
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
