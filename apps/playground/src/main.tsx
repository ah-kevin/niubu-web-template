import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { createAppStores, createAuthSession, type AppStores } from '@niubu/stores';
import { createPreferenceManager, type PreferenceManager } from '@niubu/preferences';
import { createStoragePort, type StoragePort } from '@niubu/hooks/storage';
import {
  createLocalLock,
  createUpdateChecker,
  type LocalLock,
  type LockCrypto,
  type UpdateChecker,
  type UpdateClock,
} from '@niubu/hooks';
import { createThemeRuntime } from '@niubu/hooks/theme';
import { createRequestClient, isAccessExpired, type RequestClient } from '@niubu/request';
import { appIdentity, appDefaults, appPolicy, appConfig } from './app/config';
import { PlaygroundProviders } from './app/providers';
import { createPlaygroundI18n } from './locales';
import { createPlaygroundApi } from './api';
import { createPlaygroundRoutes } from './router';
import { createPlaygroundAuthAdapter, type AuthStorage } from './auth/adapter';
import { createSessionRequest } from './auth/request';
import { browserAuthStorage } from './auth/storage';
import { isRetiredScopeQuery } from './auth/query-context';
import { resolvePlaygroundAccess } from './auth/access';
import { RuntimeConfigError } from '@niubu/utils/runtime-config';
import { readRuntimeConfig } from './runtime-config';
import './styles/index.css';

type Options = {
  runtimeConfig?: unknown;
  lockCrypto?: LockCrypto;
  updateClock?: UpdateClock;
  updateFetch?: typeof fetch;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  storage?: StoragePort;
  authStorage?: AuthStorage;
  reload?: (href: string) => void;
  createRouter?: (routes: RouteObject[]) => ReturnType<typeof createBrowserRouter>;
};
/** App owners are explicit. Authoritative restore precedes all identity-scoped owners. */
export async function startPlayground(element: HTMLElement, options: Options = {}) {
  const cleanups: Array<() => void> = [];
  let disposed = false,
    unmounted = false;
  let unmountRoot: (() => void) | undefined;
  let queryOwner: QueryClient | undefined,
    storeOwner: AppStores | undefined,
    preferenceOwner: PreferenceManager | undefined,
    apiOwner: RequestClient | undefined;
  let lockOwner: LocalLock | null = null,
    updateOwner: UpdateChecker | undefined;
  const disposeOwners = () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.reverse()) cleanup();
  };
  const dispose = () => {
    if (unmounted) return;
    unmounted = true;
    unmountRoot?.();
    disposeOwners();
  };
  const assertActive = () => {
    if (disposed || options.signal?.aborted) throw new DOMException('Playground startup cancelled', 'AbortError');
  };
  options.signal?.addEventListener('abort', dispose, { once: true });
  cleanups.push(() => options.signal?.removeEventListener('abort', dispose));
  import.meta.hot?.dispose(dispose);
  try {
    assertActive();
    const runtimeConfig = readRuntimeConfig(options, window.location.origin);
    const authRequest = createRequestClient({
      mode: 'enabled',
      baseURL: runtimeConfig.apiBaseURL,
      fetch: options.fetch ?? window.fetch.bind(window),
      credentialsProvider: () => ({ credentials: 'omit' }),
      activityReporter() {},
      errorNormalizer: error => error,
      getGeneration: () => 0,
    });
    cleanups.push(() => authRequest.dispose());
    const adapter = createPlaygroundAuthAdapter({
      request: authRequest,
      storage: options.authStorage ?? browserAuthStorage(),
    });
    cleanups.push(() => adapter.dispose());
    const auth = createAuthSession({
      adapter,
      homeHref: appConfig.homeHref,
      loginHref: '/login',
      reload: options.reload ?? (href => window.location.replace(href)),
      onIdentityReset: async () => {
        lockOwner?.cancel();
        lockOwner?.clear();
        lockOwner?.dispose();
        updateOwner?.dispose();
        apiOwner?.dispose();
        await queryOwner?.cancelQueries();
        queryOwner?.clear();
        storeOwner?.dispose();
        preferenceOwner?.dispose();
      },
      onScopeReset: async previous => {
        const predicate = (query: { queryKey: readonly unknown[] }) => isRetiredScopeQuery(query.queryKey, previous);
        await queryOwner?.cancelQueries({ predicate });
        queryOwner?.removeQueries({ predicate });
      },
    });
    cleanups.push(() => auth.dispose());
    const user = await auth.restore();
    assertActive();
    const identity = { ...appIdentity, identityKey: user?.id ?? 'anonymous' };
    const stores = createAppStores({ identityKey: identity.identityKey, readContext: null });
    storeOwner = stores;
    cleanups.push(() => stores.dispose());
    const storage = options.storage ?? createStoragePort();
    const preferences = createPreferenceManager({
      identity,
      storage,
      appDefaults,
      policy: appPolicy,
    });
    preferenceOwner = preferences;
    cleanups.push(() => preferences.dispose());
    const lock = user ? createLocalLock({ identity, storage, crypto: options.lockCrypto }) : null;
    lockOwner = lock;
    cleanups.push(() => lock?.dispose());
    const i18n = createPlaygroundI18n(preferences.getSnapshot().core.locale, document.documentElement);
    cleanups.push(() => i18n.dispose());
    try {
      await i18n.changeLocale(preferences.getSnapshot().core.locale, i18n.requiredNamespaces);
      assertActive();
    } catch (error) {
      assertActive();
      if (i18n.getSnapshot().activeLocale !== 'zh-CN') throw error;
      await i18n.ensureNamespaces(i18n.requiredNamespaces);
      assertActive();
      stores.ui.update({ localeError: 'Preferred language unavailable' });
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
    });
    queryOwner = queryClient;
    cleanups.push(() => {
      void queryClient.cancelQueries();
      queryClient.clear();
    });
    const baseRequest = createRequestClient({
      mode: 'enabled',
      baseURL: runtimeConfig.apiBaseURL,
      fetch: options.fetch ?? window.fetch.bind(window),
      credentialsProvider: signal => adapter.credentialsProvider(signal),
      activityReporter() {},
      errorNormalizer: error => error,
      getGeneration: () => auth.requestContext().generation,
      renewal: {
        shouldRenew: isAccessExpired,
        renew: async signal => {
          try {
            await auth.refresh(signal);
            return { ok: true, data: undefined };
          } catch (error) {
            return {
              ok: false,
              error: {
                kind:
                  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
                    ? 'aborted'
                    : 'http',
                status: 401,
                code: 'LOGIN_EXPIRED',
              },
            };
          }
        },
      },
    });
    adapter.bindGrantRequest(baseRequest);
    const request = createSessionRequest(baseRequest, auth),
      api = createPlaygroundApi(authRequest, request, {
        getSessionSignal: () => auth.requestContext().signal,
        getContext: () => {
          const state = auth.getSnapshot();
          return state.user && state.status === 'ready' && !state.loginExpired && state.scope?.kind === 'workspace'
            ? { identityKey: state.user.id, scope: state.scope, generation: state.generation }
            : null;
        },
      });
    apiOwner = request;
    cleanups.push(() => request.dispose());
    const theme = createThemeRuntime({
      target: document.documentElement,
      matchMedia: query => window.matchMedia(query),
    });
    cleanups.push(() => theme.dispose());
    function applyPreferences() {
      const { core } = preferences.getSnapshot();
      theme.apply({ schemaVersion: 2, mode: core.theme.mode, density: core.density, appearance: core.theme });
      if (core.locale !== i18n.getSnapshot().preferredLocale)
        void i18n
          .changeLocale(core.locale, i18n.requiredNamespaces)
          .then(() => {
            if (!disposed) stores.ui.update({ localeError: null });
          })
          .catch(() => {
            if (!disposed) stores.ui.update({ localeError: 'Preferred language unavailable' });
          });
    }
    applyPreferences();
    cleanups.push(preferences.subscribe(applyPreferences));
    const router = (options.createRouter ?? createBrowserRouter)(createPlaygroundRoutes());
    cleanups.push(() => router.dispose());
    const updates = createUpdateChecker({
      fetch: options.updateFetch ?? options.fetch ?? window.fetch.bind(window),
      indexURL: new URL('index.html', new URL(import.meta.env.BASE_URL, window.location.origin)).href,
      clock: options.updateClock ?? {
        setTimeout: (callback, ms) => window.setTimeout(callback, ms),
        clearTimeout: handle => {
          if (typeof handle === 'number') window.clearTimeout(handle);
        },
      },
    });
    updateOwner = updates;
    cleanups.push(() => updates.dispose());
    const shell = {
      lock,
      updates,
      reloadPage() {
        if (disposed || stores.interaction.getSnapshot().dirty || lock?.getSnapshot().locked) return;
        const location = router.state.location;
        if (options.reload) options.reload(location.pathname + location.search + location.hash);
        else window.location.reload();
      },
    };
    const root = createRoot(element);
    unmountRoot = () => root.unmount();
    root.render(
      <PlaygroundProviders {...{ stores, preferences, i18n, queryClient, api, auth, shell }} onUnmount={disposeOwners}>
        <RouterProvider router={router} />
      </PlaygroundProviders>,
    );

    return {
      stores,
      preferences,
      i18n,
      request,
      queryClient,
      theme,
      router,
      auth,
      api,
      lock,
      updates,
      access: () => {
        const menu = queryClient.getQueryData<Awaited<ReturnType<typeof api.menu>>>(['playground', 'public-menu']);
        return resolvePlaygroundAccess(auth.getSnapshot(), menu?.ok ? menu.data : []);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    if (error instanceof RuntimeConfigError) element.textContent = error.message;
    throw error;
  }
}
if (import.meta.env.MODE !== 'test') {
  const root = document.getElementById('root');
  if (root)
    void startPlayground(root).catch(error => {
      if (!(typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'))
        root.textContent = error instanceof RuntimeConfigError ? error.message : 'Template Playground startup failed';
    });
}
