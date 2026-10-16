import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { createRequestClient } from '@niubu/request';
import { createStoragePort } from '@niubu/hooks/storage';
import { createPreferenceManager, preferenceStorageKey } from '@niubu/preferences';
import { readPreferenceThemeSnapshot } from '@niubu/preferences/pure';
import { appIdentity, appDefaults, appPolicy } from './app/config';
import { createPlaygroundApi } from './api';
import { registry, selectPublicMenu } from './modules/demo';
import { startPlayground } from './main';

const wire = (data: unknown, status = 200, code: string | number = 0) =>
  new Response(JSON.stringify({ code, data, message: status === 200 ? 'ok' : 'Unavailable' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const client = (fetcher: typeof fetch) =>
  createRequestClient({
    mode: 'enabled',
    baseURL: 'http://playground.test',
    fetch: fetcher,
    credentialsProvider: () => ({ credentials: 'omit' }),
    activityReporter: () => {},
    errorNormalizer: error => error,
    getGeneration: () => 0,
  });
const disposals: Array<() => void> = [];
afterEach(async () => {
  await act(async () => {
    disposals.splice(0).forEach(dispose => dispose());
  });
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
});

async function mount(path: string, fetcher: typeof fetch, authenticated = false) {
  const root = document.createElement('div');
  document.body.append(root);
  let runtime!: Awaited<ReturnType<typeof startPlayground>>;
  await act(async () => {
    runtime = await startPlayground(root, { runtimeConfig: {schemaVersion:1,apiURL:'/'},
      updateFetch: async () => new Response(null,{status:200,headers:{ETag:'"unit-index-v1"'}}),
      fetch: authenticated ? async (input, init) => {
        const endpoint = new URL(String(input)).pathname;
        if (endpoint === '/api/user') return wire({id:'unit-user',name:'Unit user',roles:[],workspaces:[{kind:'workspace',id:'north'}]});
        if (endpoint === '/api/auth/codes') return wire(['demo:read','demo:echo']);
        if (endpoint === '/api/menu') return wire([{kind:'page',id:'home',pageId:'playground.home'},{kind:'page',id:'request',pageId:'playground.request'}]);
        return fetcher(input,init);
      } : fetcher,
      ...(authenticated ? {authStorage: (()=>{const values=new Map([['playground.auth.v1',JSON.stringify({version:1,tokens:{accessToken:'public-test-access',refreshToken:'public-test-refresh',tokenType:'Bearer',expiresIn:300}})]]);return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};})()} : {}),
      createRouter: routes => createMemoryRouter(routes, { initialEntries: [path] }),
    });
  });
  disposals.push(runtime.dispose);
  if (authenticated) await waitFor(()=>expect(runtime.auth.getSnapshot().status).toBe('ready'));
  return runtime;
}

describe('playground public consumer', () => {
  it('keeps persisted preferences in its own namespace and pure prepaint agrees with the manager', () => {
    localStorage.setItem('niubu.theme', 'dark');
    const storage = createStoragePort();
    const manager = createPreferenceManager({ identity: appIdentity, storage, appDefaults, policy: appPolicy });
    disposals.push(manager.dispose);
    expect(manager.update({ theme: { mode: 'light' } }).kind).toBe('persisted');
    expect([...Array(localStorage.length)].map((_, i) => localStorage.key(i))).toEqual(
      expect.arrayContaining(['niubu.theme', expect.stringMatching(/^playground\.preferences:/)]),
    );
    expect(localStorage.getItem('niubu.theme')).toBe('dark');
    expect(preferenceStorageKey(appIdentity)).not.toBe(preferenceStorageKey({ ...appIdentity, appId: 'niubu-web' }));
    expect(readPreferenceThemeSnapshot({ storage, identity: appIdentity, appDefaults, policy: appPolicy }).mode).toBe(
      'light',
    );
  });

  it('selects only known public page ids and never registers backend URLs', () => {
    expect(
      selectPublicMenu(['unknown.page', 'playground.request', 'playground.home', 'playground.request']).map(route => [
        route.id,
        route.path,
      ]),
    ).toEqual([
      ['playground.home', '/home'],
          ]);
    expect(registry.routes.map(route => route.path)).toEqual(['/home','/request','/system/users','/system/roles','/system/menus','/system/departments','/login','/embedded/:menuId','/profile']);
  });

  it('renders home health and the usable menu despite unknown backend ids', async () => {
    await mount('/home', async input =>
      String(input).endsWith('/api/menu')
        ? wire([{kind:'page',id:'home',pageId:'playground.home'},{kind:'page',id:'unknown',pageId:'unknown.page'},{kind:'page',id:'request',pageId:'playground.request'}])
        : wire({ status: 'ok' }),
    );
    expect(await screen.findByRole('heading', { name: '公共首页' })).toBeVisible();
    expect(await screen.findByText('health: ok')).toBeVisible();
    expect(await screen.findByRole('link', { name: '公共首页' })).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: '请求示例' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'unknown.page' })).not.toBeInTheDocument();
  });

  it('shows genuine health/menu failure without presenting synthetic success', async () => {
    await mount('/home', async () => wire(null, 503, 'UNAVAILABLE'));
    expect(await screen.findByText('health: http · HTTP 503 · UNAVAILABLE')).toBeVisible();
    expect(await screen.findByText('menu: http · HTTP 503 · UNAVAILABLE')).toBeVisible();
    expect(screen.queryByText('health: ok')).not.toBeInTheDocument();
  });

  it('sends an explicit JSON echo and shows the decoded result', async () => {
    const seen: RequestInit[] = [];
    await mount('/request', async (input, init) => {
      if (String(input).endsWith('/api/menu'))
        return wire([{ pageId: 'playground.home' }, { pageId: 'playground.request' }]);
      seen.push(init ?? {});
      return wire({ value: 'hello', query: ['playground'], headers: { 'x-demo': 'playground' } });
    }, true);
    fireEvent.change(await screen.findByRole('textbox', { name: '回显内容' }), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: '发送请求' }));
    expect(await screen.findByText(/"value": "hello"/)).toBeVisible();
    expect(seen[0]?.method).toBe('POST');
    expect(JSON.parse(String(seen[0]?.body))).toEqual({ value: 'hello' });
    expect(new Headers(seen[0]?.headers).get('Content-Type')).toBe('application/json');
  });

  it('shows echo failure and clears the previous success on a new attempt', async () => {
    let calls = 0;
    await mount('/request', async input => {
      if (String(input).endsWith('/api/menu')) return wire([]);
      return ++calls === 1 ? wire({ value: 'first', query: [], headers: {} }) : wire(null, 500, 'ECHO_FAILED');
    }, true);
    const send = await screen.findByRole('button', { name: '发送请求' });
    fireEvent.click(send);
    expect(await screen.findByText(/"value": "first"/)).toBeVisible();
    fireEvent.click(send);
    expect(await screen.findByText('echo: http · HTTP 500 · ECHO_FAILED')).toBeVisible();
    expect(screen.queryByText(/"value": "first"/)).not.toBeInTheDocument();
  });

  it('applies persisted English before rendering and follows live locale preferences', async () => {
    localStorage.setItem(
      preferenceStorageKey(appIdentity),
      JSON.stringify({
        schemaVersion: 1,
        core: { locale: 'en-US' },
        extensions: {},
        migrations: [],
      }),
    );
    const runtime = await mount('/home', async input =>
      String(input).endsWith('/api/menu') ? wire([{kind:'page',id:'home',pageId:'playground.home'}]) : wire({ status: 'ok' }),
    );
    expect(await screen.findByRole('heading', { name: 'Public home' })).toBeVisible();
    expect(document.documentElement.lang).toBe('en-US');
    await act(async () => {
      runtime.preferences.update({ locale: 'zh-CN' });
    });
    expect(await screen.findByRole('heading', { name: '公共首页' })).toBeVisible();
  });

  it('runs the independent theme entry without writing preferences', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    document.documentElement.dataset.theme = 'uninitialized';
    localStorage.setItem(
      preferenceStorageKey(appIdentity),
      JSON.stringify({
        schemaVersion: 1,
        core: { theme: { mode: 'dark' } },
        extensions: {},
        migrations: [],
      }),
    );
    write.mockClear();
    await import('./theme-init');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(write).not.toHaveBeenCalled();
  });

  it('disposes every owned resource on unmount, cancels requests and leaves another owner alive', async () => {
    const other = createPreferenceManager({
      identity: { ...appIdentity, storageNamespace: 'other' },
      storage: createStoragePort(),
    });
    disposals.push(other.dispose);
    const signals: AbortSignal[] = [];
    const runtime = await mount('/home', async (_input, init) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise(() => {});
    });
    await waitFor(() => expect(signals.length).toBeGreaterThan(0));
    const requestDispose = vi.spyOn(runtime.request, 'dispose');
    const i18nDispose = vi.spyOn(runtime.i18n, 'dispose');
    const themeDispose = vi.spyOn(runtime.theme, 'dispose');
    const routerDispose = vi.spyOn(runtime.router, 'dispose');
    runtime.queryClient.setQueryData(['owned'], 'cached');
    await act(async () => runtime.dispose());
    expect(runtime.stores.getSnapshot().session.disposed).toBe(true);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(runtime.preferences.update({ density: 'compact' }).kind).toBe('memory');
    expect(runtime.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(requestDispose).toHaveBeenCalledOnce();
    expect(i18nDispose).toHaveBeenCalledOnce();
    expect(themeDispose).toHaveBeenCalledOnce();
    expect(routerDispose).toHaveBeenCalledOnce();
    expect(other.update({ density: 'compact' }).kind).toBe('persisted');
  });
});

describe('public API boundary', () => {
  it('rejects malformed data and string zero rather than manufacturing success', async () => {
    const request = client(async () => wire({ status: 'ok' }, 200, '0'));
    disposals.push(request.dispose);
    const result = await createPlaygroundApi(request).health();
    expect(result.ok).toBe(false);
    const malformed = client(async () => wire({ status: 123 }));
    disposals.push(malformed.dispose);
    expect((await createPlaygroundApi(malformed).health()).ok).toBe(false);
  });

  it('forwards repeated query values and only the explicit demo header', async () => {
    let received = '';
    let headers = new Headers();
    const request = client(async (input, init) => {
      received = String(input);
      headers = new Headers(init?.headers);
      return wire({ value: 'a', query: ['x', 'y'], headers: { 'x-demo': 'playground' } });
    });
    disposals.push(request.dispose);
    expect((await createPlaygroundApi(request).echo({ value: 'a', query: { query: ['x', 'y'] } })).ok).toBe(true);
    expect(new URL(received).searchParams.getAll('query')).toEqual(['x', 'y']);
    expect(headers.get('X-Demo')).toBe('playground');
    expect(headers.has('Authorization')).toBe(false);
  });
});
