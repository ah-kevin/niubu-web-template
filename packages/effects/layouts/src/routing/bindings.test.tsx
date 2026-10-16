import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { createPageIdentityResolver, createAppStores } from '@niubu/stores';
import { StoresProvider } from '@niubu/stores/react';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks';
import type { ReadContext, RouteMeta } from '@niubu/core-typings';
import { createRoutes, createRouteMatcher, PageTabsBinding, RouteRestoration, NavigationGuard, RouteFrame, usePageTabs, pageIntentStateKey, type PageRoutingRuntime } from './index';

const disposers: (() => void)[] = [];
afterEach(() => { cleanup(); disposers.splice(0).forEach(dispose => dispose()); });

it('binds injected routes, commits real tab intent and restores the remaining page', async () => {
  const common = { scope: 'region', capability: null, titleKey: 'record', iconToken: 'File', order: 1, navigation: true } as const;
  const routes: readonly RouteMeta[] = [{ ...common, id: 'list', path: '/records' }, { ...common, id: 'detail', path: '/records/:id' }];
  const context: ReadContext = { scope: { kind: 'region', id: 'r1' }, businessDate: '2026-10-17', timeZone: 'UTC' };
  const find = createRouteMatcher(routes, id => /^[a-z0-9]+$/.test(id));
  const identity = createPageIdentityResolver({ routes, findRoute: find, resolveScope: () => ({ allowed: true as const, scope: context.scope }), resolveUrlView: () => undefined, policies: {}, aliases: {}, needsReport: () => false, isPageRoute: () => true });
  const runtime: PageRoutingRuntime = {
    describe: (location, report) => identity.describePageLocation(location, context, null, report),
    resolveTab: identity.resolvePageTab,
    home: () => identity.describePageLocation({ pathname: '/records', search: '', hash: '' }, context, null),
    renderTab: tab => ({ label: tab.routeId }),
    isContentRoute: location => !!find(location.pathname, location.search),
    intentStateKey: pageIntentStateKey('example'),
  };
  function Probe() {
    const tabs = usePageTabs();
    return <><output data-testid="tabs">{tabs.snapshot.tabs.map(tab => tab.routeId).join(',')}</output><button onClick={() => { if (tabs.snapshot.activeKey) tabs.request({ type: 'close', key: tabs.snapshot.activeKey }); }}>Close current</button></>;
  }
  const router = createMemoryRouter(createRoutes({
    routes, homeHref: '/records',
    loaders: { '/records': async () => ({ Component: () => <h1>Records</h1> }), '/records/:id': async () => ({ Component: () => <h1>Detail</h1> }) },
    renderFrame: ({ registered, path }) => <RouteFrame registered={registered} path={path} appTitle="Example Console" describe={(location, ctx, report) => identity.describePageLocation(location, ctx, null, report)} resolveTab={identity.resolvePageTab} resolveFrame={location => ({ title: location.pathname === '/records' ? 'Records' : 'Detail', kind: 'protected', context, scope: context.scope })} requiresReport={() => false} renderShell={(_kind, children) => <main id="main-content" tabIndex={-1}>{children}</main>} renderFallback={() => <p>Unavailable</p>} />,
    renderRoot: children => <PageTabsBinding runtime={runtime}><RouteRestoration runtime={runtime}><NavigationGuard /><Probe />{children}</RouteRestoration></PageTabsBinding>,
  }), { initialEntries: ['/records'] });
  const stores = createAppStores({ identityKey: 'one', readContext: context });
  const manager = createPreferenceManager({ identity: { storageNamespace: 'example', product: 'example', appId: 'fixture', environment: 'test', identityKey: 'one' }, storage: createStoragePort({ getItem: () => null, setItem: () => {} }) });
  render(<StoresProvider stores={stores}><PreferenceProvider manager={manager}><RouterProvider router={router} /></PreferenceProvider></StoresProvider>);
  disposers.push(() => { router.dispose(); manager.dispose(); stores.dispose(); });
  await screen.findByRole('heading', { name: 'Records' });
  await waitFor(() => expect(screen.getByTestId('tabs')).toHaveTextContent('list'));
  await act(async () => { await router.navigate('/records/a1'); });
  await screen.findByRole('heading', { name: 'Detail' });
  await waitFor(() => expect(screen.getByTestId('tabs')).toHaveTextContent('list,detail'));
  fireEvent.click(screen.getByRole('button', { name: 'Close current' }));
  await screen.findByRole('heading', { name: 'Records' });
  await waitFor(() => expect(screen.getByTestId('tabs').textContent).toBe('list'));
  expect(document.title).toBe('Records · Example Console');
});
