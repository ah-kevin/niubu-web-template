import { createElement, Fragment, useEffect, type ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { createAppStores, createPageIdentityResolver, tabSessionKey } from '@niubu/stores';
import { StoresProvider } from '@niubu/stores/react';
import type { ReadContext, RouteMeta } from '@niubu/types';
import { createPreferenceManager, PreferenceProvider } from '../../packages/preferences/src/index';
import type { DeepPartial, CorePreferences } from '../../packages/@core/preferences/src/index';
import { createI18n } from '../../packages/locales/src/index';
import { I18nProvider } from '../../packages/locales/src/react';
import { createRouteMatcher, NavigationGuard, PageTabsBinding, usePageTabs, pageIntentStateKey, type PageRoutingRuntime } from '../../packages/effects/layouts/src/routing/index';

export const context: ReadContext = { scope: { kind: 'region', id: 'north/one & two' }, businessDate: '2026-10-17', timeZone: 'UTC' };
const common = { scope: 'region', capability: null, iconToken: 'records', order: 1, navigation: true } as const;
export const routes: readonly RouteMeta[] = [
  { ...common, id: 'start', path: '/start', titleKey: 'Home' },
  { ...common, id: 'records', path: '/records', titleKey: 'Records' },
  { ...common, id: 'detail', path: '/records/:id', titleKey: 'Detail' },
  { ...common, id: 'audit', path: '/audit', titleKey: 'Audit' },
];
export const scoped = (path: string) => `${path}?scopeKind=region&scopeId=north%2Fone+%26+two`;

/** Public owners only; no application policy, network or persistent browser storage. */
export async function preferenceScene(patch: DeepPartial<CorePreferences> = {}) {
  const values = new Map<string, string>();
  const identity = { product: 'example', storageNamespace: 'example', appId: 'preferences', environment: 'test', identityKey: 'one' };
  const manager = createPreferenceManager({ identity, storage: { read: key => ({ ok: true, value: values.get(key) ?? null }), write: (key, value) => { values.set(key, value); return { ok: true }; } } });
  manager.update(patch);
  const stores = createAppStores({ identityKey: 'one', readContext: context });
  const i18n = createI18n({ defaultLocale: 'en-US', appLoaders: {} });
  try { await i18n.changeLocale('en-US', i18n.requiredNamespaces); }
  catch (error) { manager.dispose(); stores.dispose(); i18n.dispose(); throw error; }
  const views: Array<ReturnType<typeof render>> = [];
  const routers: Array<ReturnType<typeof createMemoryRouter>> = [];
  const wrap = (children: ReactNode) => createElement(StoresProvider, { stores, children: createElement(PreferenceProvider, { manager, children: createElement(I18nProvider, { instance: i18n, children }) }) });
  const mount = (children: ReactNode) => { const view = render(wrap(children)); views.push(view); return { ...view, rerender: (value: ReactNode) => view.rerender(wrap(value)) }; };
  const find = createRouteMatcher(routes, id => /^[a-z0-9]+$/.test(id));
  const resolver = createPageIdentityResolver({ routes, findRoute: find, resolveScope: () => ({ allowed: true as const, scope: context.scope }), resolveUrlView: () => undefined, policies: {}, aliases: {}, needsReport: () => false, isPageRoute: () => true });
  const runtime: PageRoutingRuntime = {
    describe: (location, report) => resolver.describePageLocation(location, context, null, report),
    resolveTab: resolver.resolvePageTab,
    home: () => resolver.describePageLocation({ pathname: '/start', search: scoped('/start').split('?')[1]!, hash: '' }, context, null),
    renderTab: tab => ({ label: routes.find(route => route.id === tab.routeId)!.titleKey, icon: createElement('i', { 'data-testid': 'tab-icon' }) }),
    isContentRoute: location => !!find(location.pathname, location.search),
    intentStateKey: pageIntentStateKey('example'),
  };
  const session = { identity, storageNamespace: 'example', port: { read: (key: string) => ({ ok: true as const, value: values.get(key) ?? null }), write: (key: string, value: string) => { values.set(key, value); return { ok: true as const }; }, remove: (key: string) => { values.delete(key); return { ok: true as const }; } } };
  function Commit() {
    const { commit, snapshot } = usePageTabs(), location = useLocation();
    useEffect(() => { commit(runtime.describe(location, { locationKey: location.key })); }, [commit, snapshot, location]);
    return null;
  }
  return {
    manager, stores, i18n, values, runtime, session, sessionKey: tabSessionKey(identity, 'example'), mount,
    mountRouter(children: ReactNode, entry = scoped('/records')) {
      const router = createMemoryRouter([{ path: '*', element: createElement(PageTabsBinding, { runtime, session, children: createElement(Fragment, null, createElement(NavigationGuard), createElement(Commit), children) }) }], { initialEntries: [entry] });
      routers.push(router);
      mount(createElement(RouterProvider, { router }));
      return router;
    },
    async dispose() {
      try { await act(async () => { views.reverse().forEach(view => view.unmount()); }); }
      finally { routers.forEach(router => router.dispose()); manager.dispose(); stores.dispose(); i18n.dispose(); values.clear(); }
    },
  };
}
