import { selectOption } from '../tests/select-option';
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { createAppStores, createAuthSession } from '@niubu/stores';
import { createRequestClient } from '@niubu/request';
import { createPreferenceManager } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks/storage';
import { BodyApp } from '../app/BodyApp';
import { PlaygroundProviders } from '../app/providers';
import { appDefaults, appIdentity, appPolicy } from '../app/config';
import { useAuthSnapshot } from '../auth/context';
import type { LoginInput, PlaygroundUser } from '../auth/schemas';
import { createPlaygroundApi } from '../api';
import { createPlaygroundI18n } from '../locales';

const disposers: (() => void)[] = [];
afterEach(() => { cleanup(); disposers.splice(0).reverse().forEach(dispose => dispose()); });
const north = { kind: 'workspace', id: 'north' } as const;
const south = { kind: 'workspace', id: 'south' } as const;

async function mount() {
  const user: PlaygroundUser = { id: 'routing-user', name: 'Routing user', roles: [], workspaces: [north, south] };
  const scopeReset = vi.fn();
  const auth = createAuthSession<PlaygroundUser, LoginInput>({
    adapter: {
      restore: async () => user, login: async () => user, logout: async () => {}, refresh: async () => {},
      getCodes: async scope => scope?.id === 'north' ? ['demo:read', 'demo:echo'] : ['demo:read'],
      getMenu: async () => [{ kind: 'page', id: 'home', pageId: 'playground.home' }],
      credentialsProvider: () => ({ credentials: 'omit' }), invalidateLocal() {},
    },
    onIdentityReset() {}, onScopeReset: scopeReset, reload() {}, homeHref: '/home', loginHref: '/login',
  });
  await auth.restore(); await auth.switchScope(north); scopeReset.mockClear();
  const originalSwitchScope = auth.switchScope.bind(auth);
  const switchScope = vi.spyOn(auth, 'switchScope');
  const stores = createAppStores({ identityKey: user.id, readContext: null });
  const preferences = createPreferenceManager({ identity: { ...appIdentity, identityKey: user.id }, appDefaults, policy: appPolicy,
    storage: createStoragePort({ getItem: () => null, setItem: () => {} }) });
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const network = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ code: 0, data: [], message: 'ok' }), { headers: { 'Content-Type': 'application/json' } }));
  const request = createRequestClient({ mode: 'enabled', baseURL: 'http://routing.test', fetch: network,
    credentialsProvider: () => ({ credentials: 'omit' }), activityReporter() {}, errorNormalizer: error => error, getGeneration: () => auth.getSnapshot().generation });
  const api = createPlaygroundApi(request);
  const draftScope = JSON.stringify([user.id, north]);
  const draftKey = JSON.stringify(['users', 'one']);
  function Editor({ scope }: { scope: string }) {
    const activeKey = JSON.stringify(['editor', scope]);
    useEffect(() => () => stores.interaction.setDirty(activeKey, false), [activeKey]);
    return <input aria-label="Editor name" defaultValue="Original" onChange={event => {
      stores.interaction.writeDraft(JSON.stringify([user.id, { kind: 'workspace', id: scope }]), draftKey, { name: event.target.value });
      stores.interaction.setDirty(activeKey, true);
    }} />;
  }
  function Root() {
    const state = useAuthSnapshot();
    return <BodyApp><Editor key={state.scope?.id} scope={state.scope?.id ?? ''} /></BodyApp>;
  }
  const router = createMemoryRouter([{ path: '/home', element: <Root /> }], { initialEntries: ['/home?view=table&scopeKind=workspace&scopeId=north#editor'] });
  render(<PlaygroundProviders stores={stores} preferences={preferences} i18n={i18n} queryClient={queryClient} api={api} auth={auth} onUnmount={() => {}}><RouterProvider router={router} /></PlaygroundProviders>);
  disposers.push(() => { router.dispose(); request.dispose(); queryClient.clear(); i18n.dispose(); preferences.dispose(); stores.dispose(); auth.dispose(); });
  await screen.findByRole('textbox', { name: 'Editor name' });
  return { auth, stores, router, switchScope, scopeReset, network, draftScope, draftKey, originalSwitchScope };
}

describe('workspace navigation commits before auth scope changes', () => {
  it('cancel keeps URL, grants, native request signal and dirty editor; does not call scope switch', async () => {
    const f = await mount();
    const before = f.auth.getSnapshot();
    const native = f.auth.requestContext();
    const input = screen.getByRole('textbox', { name: 'Editor name' });
    fireEvent.change(input, { target: { value: 'Keep draft' } });
    await selectOption(screen.getByRole('combobox', { name: '工作空间' }), 'south');
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('返回后可选择恢复；未保存的更改不会提交。');
    expect(f.router.state.location.search).toBe('?view=table&scopeKind=workspace&scopeId=north');
    expect(f.switchScope).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '继续编辑' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(f.router.state.location).toMatchObject({ pathname: '/home', search: '?view=table&scopeKind=workspace&scopeId=north', hash: '#editor' });
    expect(f.auth.getSnapshot()).toBe(before);
    expect(f.auth.getSnapshot().codes).toEqual(['demo:read', 'demo:echo']);
    expect(f.auth.requestContext()).toBe(native);
    expect(native.signal.aborted).toBe(false);
    expect(f.scopeReset).not.toHaveBeenCalled();
    expect(f.network).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Editor name' })).toBe(input);
    expect(input).toHaveValue('Keep draft');
    expect(f.stores.interaction.getSnapshot().dirty).toBe(true);
    expect(f.stores.interaction.readDraft(f.draftScope, f.draftKey)).toEqual({ name: 'Keep draft' });
  });
  it('confirm commits Router once, then changes scope and retires old requests without deleting historical draft', async () => {
    const f = await mount();
    const native = f.auth.requestContext();
    fireEvent.change(screen.getByRole('textbox', { name: 'Editor name' }), { target: { value: 'Historical draft' } });
    const committedAtSwitch: string[] = [];
    const original = f.originalSwitchScope;
    f.switchScope.mockImplementation(scope => { committedAtSwitch.push(f.router.state.location.search); return original(scope); });
    await selectOption(screen.getByRole('combobox', { name: '工作空间' }), 'south');
    const dialog = await screen.findByRole('alertdialog');
    expect(f.switchScope).not.toHaveBeenCalled(); expect(native.signal.aborted).toBe(false);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: '保留草稿并离开' })); });
    await waitFor(() => expect(f.auth.getSnapshot()).toMatchObject({ status: 'ready', scope: south }));
    expect(f.switchScope).toHaveBeenCalledTimes(1);
    expect(f.switchScope).toHaveBeenCalledWith(south);
    expect(committedAtSwitch).toEqual(['?view=table&scopeKind=workspace&scopeId=south']);
    expect(f.router.state.location.hash).toBe('#editor');
    expect(native.signal.aborted).toBe(true);
    expect(f.scopeReset).toHaveBeenCalledTimes(1);
    expect(f.stores.interaction.getSnapshot().dirty).toBe(false);
    expect(f.stores.interaction.readDraft(f.draftScope, f.draftKey)).toEqual({ name: 'Historical draft' });
    expect(screen.getByRole('textbox', { name: 'Editor name' })).toHaveValue('Original');
  });
});
