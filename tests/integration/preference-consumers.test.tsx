import { existsSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { preferenceControls } from '../../packages/effects/common-ui/src/preferences/control-schema';
import { act, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { Link } from 'react-router-dom';
import { projectBreadcrumbs, type NavigationRoute } from '../../packages/effects/access/src/index';
import * as widgets from '../../packages/effects/layouts/src/widgets/index';
import { BusinessShell } from '../../packages/effects/layouts/src/index';
import { PageTabsView, RouteMotion, RoutePending, RoutePresentation } from '../../packages/effects/layouts/src/routing/index';
import { ManagedPreferenceDrawer } from '../../packages/effects/common-ui/src/preferences/index';
import { usePreferenceSnapshot } from '../../packages/preferences/src/index';
import { formatInstant } from '../../packages/locales/src/index';
import { serializeTabSession } from '@niubu/stores';
import { mountPlayground } from './playground-fixture';
import { context, preferenceScene, routes, scoped } from './preference-consumer-fixture';
import { createShortcutRuntime } from '../../packages/effects/hooks/src/index';
import { resolveBusinessLayout } from '../../packages/@core/ui-kit/layout-ui/src/layout-model';
import type { CorePreferences, DeepPartial } from '../../packages/@core/preferences/src/index';

// Radix measures controls; jsdom provides no layout observer.
beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterAll(() => vi.unstubAllGlobals());

it('keeps every implemented preference evidence file inside the independent workspace', () => {
  let root = process.cwd();
  while (!existsSync(resolve(root, 'packages/effects/common-ui/src/preferences/control-schema.ts'))) {
    const parent = resolve(root, '..');
    expect(parent, 'workspace root must be discoverable').not.toBe(root);
    root = parent;
  }
  root = realpathSync(root);
  expect(preferenceControls).toHaveLength(86);
  for (const control of preferenceControls) {
    expect(control.availability).toBe('implemented');
    for (const field of ['consumer', 'test'] as const) {
      const path = resolve(root, control[field]);
      expect(path.startsWith(root + sep), `${control.key}.${field}: containment`).toBe(true);
      expect(existsSync(path), `${control.key}.${field}: ${control[field]}`).toBe(true);
      expect(realpathSync(path).startsWith(root + sep)).toBe(true);
    }
  }
});

it('renders visible projected region ancestors with exact scope and a non-link current page', async () => {
  expect(widgets).toHaveProperty('Breadcrumbs');
  const { Breadcrumbs } = widgets;
  const scene = await preferenceScene();
  try {
    const pages: readonly NavigationRoute[] = routes.map(route => ({ ...route, domain: route.id === 'start' ? 'home' : 'records', groupKey: 'workspace' }));
    const current = { ...pages[2]!, path: '/records/a1/edit', titleKey: 'Edit' };
    const items = projectBreadcrumbs(current, context.scope, [pages[0]!, pages[1]!, pages[2]!], { homePath: '/start', domainLabels: { records: 'Records region' } });
    scene.mount(<Breadcrumbs items={items} value={{ enabled: true, hideOnlyOne: false, showHome: true, showIcon: true, style: 'background' }} renderLink={(item, children) => <a href={item.href}>{children}</a>} renderIcon={token => <i data-testid="projected-icon">{token}</i>} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumbs' });
    expect(within(nav).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([scoped('/start'), scoped('/records')]);
    expect(within(nav).getByText('Records region')).not.toHaveAttribute('aria-current');
    expect(within(nav).getByText('Edit')).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(nav).getAllByTestId('projected-icon')).toHaveLength(4);
    expect(nav).toHaveAttribute('data-breadcrumb-style', 'background');
  } finally { await scene.dispose(); }
});

it('updates the real tab view and shell from all display and interaction preferences', async () => {
  const scene = await preferenceScene({ tabbar: { enabled: true, showIcon: true, draggable: true, wheelable: true, showMore: true, showMaximize: true, showRefresh: true, middleClickClose: true, style: 'chrome' } });
  try {
    const router = scene.mountRouter(<BusinessShell brand="Example" navigation={[]} renderLink={({ href, ...props }) => <Link to={href} {...props} />} tabs={<PageTabsView />}><main id="main-content">Records region</main></BusinessShell>);
    await waitFor(() => expect(scene.stores.tabs.getSnapshot().tabs.map(tab => tab.routeId)).toEqual(['start', 'records']));
    const navigation = screen.getByRole('navigation', { name: 'Open pages' });
    expect(navigation).toHaveAttribute('data-style', 'chrome');
    expect(within(navigation).getAllByTestId('tab-icon')).toHaveLength(2);
    expect(within(navigation).getByRole('button', { name: 'Records' }).closest('.page-tab')).toHaveAttribute('draggable', 'true');
    expect(within(navigation).getByRole('button', { name: 'More page actions' })).toBeVisible();
    expect(within(navigation).getByRole('button', { name: 'Maximize content' })).toBeVisible();
    const records = scene.stores.tabs.getSnapshot().tabs.find(tab => tab.routeId === 'records')!;
    fireEvent.click(within(navigation).getByRole('button', { name: 'Refresh page' }));
    await waitFor(() => expect(scene.stores.tabs.getSnapshot().tabs.find(tab => tab.key === records.key)?.refreshNonce).toBe(1));
    const scroll = within(navigation).getByTestId('page-tab-scroll');
    Object.defineProperties(scroll, { scrollWidth: { configurable: true, value: 1000 }, clientWidth: { configurable: true, value: 100 } });
    fireEvent.wheel(scroll, { deltaY: 40 });
    expect(scroll.scrollLeft).toBe(40);
    act(() => { scene.manager.update({ tabbar: { draggable: false, wheelable: false, middleClickClose: false, showIcon: false, showMore: false, showMaximize: false, showRefresh: false, style: 'plain' } }); });
    expect(navigation).toHaveAttribute('data-style', 'plain');
    expect(within(navigation).queryAllByTestId('tab-icon')).toHaveLength(0);
    expect(within(navigation).getByRole('button', { name: 'Records' }).closest('.page-tab')).toHaveAttribute('draggable', 'false');
    for (const name of ['More page actions', 'Maximize content', 'Refresh page']) expect(within(navigation).queryByRole('button', { name })).not.toBeInTheDocument();
    scroll.scrollLeft = 40;
    fireEvent.wheel(scroll, { deltaY: 40 }); expect(scroll.scrollLeft).toBe(40);
    fireEvent(within(navigation).getByRole('button', { name: 'Records' }).closest('.page-tab')!, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(scene.stores.tabs.getSnapshot().tabs.some(tab => tab.key === records.key)).toBe(true);
    act(() => { scene.manager.update({ tabbar: { middleClickClose: true } }); });
    fireEvent(within(navigation).getByRole('button', { name: 'Records' }).closest('.page-tab')!, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    await waitFor(() => expect(scene.stores.tabs.getSnapshot().tabs.map(tab => tab.routeId)).toEqual(['start']));
    expect(router.state.location.pathname).toBe('/start');
    act(() => { scene.manager.update({ tabbar: { enabled: false } }); });
    expect(screen.queryByRole('navigation', { name: 'Open pages' })).not.toBeInTheDocument();
  } finally { await scene.dispose(); }
});

it('reorders unpinned page tabs only while draggable is enabled', async () => {
  const scene = await preferenceScene({ tabbar: { draggable: true } });
  try {
    const router = scene.mountRouter(<PageTabsView />);
    await waitFor(() => expect(scene.stores.tabs.getSnapshot().tabs).toHaveLength(2));
    await act(async () => { await router.navigate(scoped('/records/a1')); });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Detail' }), { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(scene.stores.tabs.getSnapshot().tabs.map(tab => tab.routeId)).toEqual(['start', 'detail', 'records']);
    act(() => { scene.manager.update({ tabbar: { draggable: false } }); });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Detail' }), { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(scene.stores.tabs.getSnapshot().tabs.map(tab => tab.routeId)).toEqual(['start', 'detail', 'records']);
  } finally { await scene.dispose(); }
});

it('consumes sidebar controls, menu style, accordion and header alignment in the real shell', async () => {
  const scene = await preferenceScene({ sidebar: { draggable: true, showCollapseButton: true, showFixedButton: true, collapsedShowTitle: true, autoActivateChild: true }, menu: { style: 'plain', accordion: true } });
  const navigation = [{ kind: 'branch' as const, id: 'group', label: 'Workspace', presentation: 'group' as const, children: [
    { kind: 'branch' as const, id: 'records', label: 'Records region', children: [{ kind: 'leaf' as const, id: 'list', label: 'Records', href: scoped('/records'), active: false }] },
    { kind: 'branch' as const, id: 'audit', label: 'Audit region', children: [{ kind: 'leaf' as const, id: 'audit-list', label: 'Audit', href: scoped('/audit'), active: false }] },
  ] }];
  const visited: string[] = [];
  try {
    const view = scene.mount(<BusinessShell brand="Example" navigation={navigation} renderLink={props => <a {...props} />} onNavigateTo={href => visited.push(href)}><h1>Record content</h1></BusinessShell>);
    const nav = screen.getByRole('navigation', { name: 'Business navigation' });
    expect(nav).toHaveAttribute('data-menu-style', 'plain'); expect(nav).toHaveAttribute('data-show-title', 'true');
    const resize = screen.getByRole('separator', { name: 'Resize sidebar' });
    fireEvent.keyDown(resize, { key: 'ArrowRight' });
    expect(scene.manager.getSnapshot().core.sidebar.width).toBe(232);
    expect(within(screen.getByRole('complementary', { name: 'Workspace navigation' })).getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unpin sidebar' })).toBeVisible();
    fireEvent.click(within(nav).getByRole('button', { name: 'Records region' }));
    fireEvent.click(within(nav).getByRole('button', { name: 'Audit region' }));
    expect(within(nav).getByRole('button', { name: 'Records region' })).toHaveAttribute('aria-expanded', 'false');
    act(() => { scene.manager.update({ menu: { accordion: false, style: 'rounded' }, sidebar: { draggable: false, showCollapseButton: false, showFixedButton: false, collapsedShowTitle: false } }); });
    fireEvent.click(within(nav).getByRole('button', { name: 'Records region' }));
    expect(within(nav).getByRole('button', { name: 'Records region' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(nav).getByRole('button', { name: 'Audit region' })).toHaveAttribute('aria-expanded', 'true');
    expect(nav).toHaveAttribute('data-menu-style', 'rounded'); expect(nav).toHaveAttribute('data-show-title', 'false');
    expect(screen.queryByRole('separator', { name: 'Resize sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpin sidebar' })).not.toBeInTheDocument();
    act(() => { scene.manager.update({ layout: { mode: 'two-column' } }); });
    fireEvent.click(screen.getByRole('button', { name: 'Audit region' }));
    expect(visited).toEqual([scoped('/audit')]);
    act(() => { scene.manager.update({ sidebar: { autoActivateChild: false } }); });
    fireEvent.click(screen.getByRole('button', { name: 'Records region' }));
    expect(visited).toEqual([scoped('/audit')]);
    act(() => { scene.manager.update({ layout: { mode: 'horizontal' }, header: { menuAlign: 'center' } }); });
    expect(view.container.querySelector('.layout-top-navigation')).toHaveStyle({ justifyContent: 'center' });
    act(() => { scene.manager.update({ header: { menuAlign: 'end' } }); });
    expect(view.container.querySelector('.layout-top-navigation')).toHaveStyle({ justifyContent: 'end' });
  } finally { await scene.dispose(); }
});

it('consumes every layout-model field with independent non-default geometry expectations', async () => {
  const scene = await preferenceScene();
  const cases: readonly { patch: DeepPartial<CorePreferences>; expected: Record<string, string | number | boolean>; hovered?: boolean }[] = [
    { patch: { layout: { mode: 'horizontal' } }, expected: { mode: 'horizontal', topNavigationEnabled: true, sidebarEnabled: false } },
    { patch: { layout: { contentMode: 'fixed' } }, expected: { contentMode: 'fixed' } },
    { patch: { layout: { fixedWidth: 1180 } }, expected: { fixedWidth: 1180 } },
    { patch: { layout: { contentPadding: 28 } }, expected: { contentPadding: 28 } },
    { patch: { sidebar: { enabled: false } }, expected: { sidebarEnabled: false, primarySpace: 0 } },
    { patch: { sidebar: { collapsed: true } }, expected: { sidebarCollapsed: true, primarySpace: 60, primaryWidth: 60 } },
    { patch: { sidebar: { fixed: false } }, expected: { sidebarFixed: false } },
    { patch: { sidebar: { width: 280 } }, expected: { sidebarWidth: 280, primarySpace: 280, primaryWidth: 280 } },
    { patch: { sidebar: { collapsed: true, expandOnHover: false } }, hovered: true, expected: { primaryWidth: 60 } },
    { patch: { sidebar: { collapsed: true, expandOnHover: true } }, hovered: true, expected: { primaryWidth: 224 } },
    { patch: { header: { enabled: false } }, expected: { headerEnabled: false, tabbarOffset: 0 } },
    { patch: { header: { mode: 'static' } }, expected: { headerFixed: false, tabbarFixed: false } },
    { patch: { layout: { mode: 'two-column' }, menu: { split: false } }, expected: { primaryKind: 'tree', secondarySidebarEnabled: false } },
    { patch: { layout: { mode: 'two-column' }, menu: { split: true } }, expected: { primaryKind: 'rail', secondarySidebarEnabled: true } },
    { patch: { footer: { enabled: false } }, expected: { footerEnabled: false } },
    { patch: { footer: { fixed: true } }, expected: { footerFixed: true } },
  ];
  try {
    for (const { patch, expected, hovered } of cases) {
      scene.manager.reset(); scene.manager.update(patch);
      expect(resolveBusinessLayout(scene.manager.getSnapshot().core, 'desktop', { hovered }), JSON.stringify(patch)).toMatchObject(expected);
    }
  } finally { await scene.dispose(); }
});

it('applies tab binding history, capacity and persistence without serializing refresh state', async () => {
  const scene = await preferenceScene({ tabbar: { persist: true, visitHistory: true, maxCount: 3 } });
  try {
    const router = scene.mountRouter(<PageTabsView />);
    await waitFor(() => expect(scene.stores.tabs.getSnapshot().tabs).toHaveLength(2));
    await act(async () => { await router.navigate(scoped('/records/a1')); });
    await waitFor(() => expect(scene.stores.tabs.getSnapshot().tabs).toHaveLength(3));
    expect(scene.stores.tabs.getSnapshot().visitOrder).toHaveLength(2);
    expect(JSON.parse(scene.values.get(scene.sessionKey)!).tabs.map((tab: { routeId: string }) => tab.routeId)).toEqual(['start', 'records', 'detail']);
    act(() => { scene.manager.update({ tabbar: { maxCount: 2, visitHistory: false } }); });
    expect(scene.stores.tabs.getSnapshot().visitOrder).toEqual([]);
    expect(scene.stores.tabs.getSnapshot().overflow).toBe(true);
    await act(async () => { await router.navigate(scoped('/audit')); });
    expect(router.state.location.pathname).toBe('/records/a1');
    expect(scene.stores.tabs.getSnapshot().tabs.map(tab => tab.routeId)).toEqual(['start', 'records', 'detail']);
    expect(screen.getByText(/The page limit is reached/)).toBeVisible();
    act(() => { scene.manager.update({ tabbar: { maxCount: 3 } }); });
    await act(async () => { await router.navigate(scoped('/audit')); });
    await waitFor(() => expect(scene.stores.tabs.getSnapshot().tabs.map(tab => tab.routeId)).toEqual(['start', 'detail', 'audit']));
    expect(scene.stores.tabs.getSnapshot().overflow).toBe(false);
    expect(scene.stores.tabs.getSnapshot().visitOrder).toEqual([]);
    expect(scene.values.get(scene.sessionKey)).not.toContain('refreshNonce');
    act(() => { scene.manager.update({ tabbar: { persist: false } }); });
    expect(scene.values.has(scene.sessionKey)).toBe(false);
    expect(scene.stores.tabs.getSnapshot().tabs.map(tab => tab.routeId)).toEqual(['start', 'detail', 'audit']);
  } finally { await scene.dispose(); }
});

it('restores only a matching persisted identity when the tab preference allows it', async () => {
  for (const persist of [true, false]) {
    const scene = await preferenceScene({ tabbar: { persist } });
    try {
      const saved = scene.runtime.resolveTab(scene.runtime.describe({ pathname: '/audit', search: scoped('/audit').split('?')[1]!, hash: '' }))!;
      scene.values.set(scene.sessionKey, serializeTabSession([{ ...saved, refreshNonce: 7 }], scene.session.identity));
      scene.mountRouter(<PageTabsView />);
      await waitFor(() => expect(scene.stores.tabs.getSnapshot().tabs.some(tab => tab.routeId === 'records')).toBe(true));
      expect(scene.stores.tabs.getSnapshot().tabs.some(tab => tab.routeId === 'audit')).toBe(persist);
      if (persist) expect(scene.stores.tabs.getSnapshot().tabs.find(tab => tab.routeId === 'audit')!.refreshNonce).toBe(0);
      else expect(scene.values.has(scene.sessionKey)).toBe(false);
    } finally { await scene.dispose(); }
  }
});

it.each(['search', 'preferences', 'theme', 'language', 'timezone', 'fullscreen', 'refresh', 'notification'] as const)('consumes enabled and every placement for the %s tool', async widget => {
  const scene = await preferenceScene();
  const header = document.createElement('div'); document.body.append(header);
  try {
    scene.mount(<widgets.FoundationTools sessionKey="fixture" headerAvailable headerTarget={header} onRefresh={() => {}} search={{ locale: 'en-US', pages: [], renderLink: props => <a {...props} /> }} notifications={{ items: [], renderLink: props => <a {...props} /> }} renderPreferences={() => <p>Preference content</p>} />);
    const launcher = () => document.querySelector<HTMLElement>(`[data-widget-id="${widget}"]`);
    for (const position of ['header', 'auto', 'fixed', 'user-dropdown'] as const) {
      act(() => { scene.manager.update({ widget: { [widget]: { enabled: true, position } } }); });
      if (position === 'user-dropdown') {
        fireEvent.keyDown(screen.getByRole('button', { name: 'Workspace tools' }), { key: 'ArrowDown' });
        await waitFor(() => expect(launcher()).not.toBeNull());
        expect(launcher()).toHaveAttribute('data-widget-position', 'user-dropdown');
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      } else {
        expect(launcher()).toHaveAttribute('data-widget-position', position === 'auto' ? 'header' : position);
        expect(position === 'fixed' ? launcher()!.closest('.foundation-fixed-tools') : header.contains(launcher())).toBeTruthy();
      }
    }
    act(() => { scene.manager.update({ widget: { [widget]: { enabled: false } } }); });
    expect(launcher()).toBeNull();
    if (widget === 'preferences') expect(screen.getByRole('button', { name: 'Recover display preferences' })).toBeVisible();
  } finally { await scene.dispose(); header.remove(); }
});

it('consumes all copyright values safely and keeps watermark display independent of business facts', async () => {
  const scene = await preferenceScene({ copyright: { enabled: true, companyName: 'Example studio', companyUrl: 'https://example.test/company', year: '2026', icpNumber: 'Registration 42', icpUrl: 'https://example.test/registration' }, general: { watermark: true, watermarkText: 'Public sample' } });
  function Decorations() { const { core } = usePreferenceSnapshot(); return <><widgets.Copyright value={core.copyright} /><widgets.Watermark /></>; }
  try {
    const view = scene.mount(<Decorations />);
    expect(screen.getByRole('link', { name: 'Example studio' })).toHaveAttribute('href', 'https://example.test/company');
    expect(screen.getByRole('link', { name: 'Registration 42' })).toHaveAttribute('href', 'https://example.test/registration');
    expect(view.container.querySelector('.foundation-copyright')).toHaveTextContent('2026');
    const watermark = view.container.querySelector('.foundation-watermark')!;
    expect(watermark).toHaveAttribute('aria-hidden', 'true'); expect(watermark).toHaveStyle({ pointerEvents: 'none' });
    expect(within(watermark as HTMLElement).getAllByText('Public sample')).toHaveLength(24);
    act(() => { scene.manager.update({ copyright: { companyName: 'Renamed', companyUrl: '', year: '2030', icpNumber: 'New registration', icpUrl: '' }, general: { watermarkText: 'Changed sample' } }); });
    expect(view.container.querySelector('.foundation-copyright')).toHaveTextContent('2030 Renamed · New registration');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getAllByText('Changed sample')).toHaveLength(24);
    act(() => { scene.manager.update({ copyright: { enabled: false }, general: { watermark: false } }); });
    expect(view.container.querySelector('.foundation-copyright')).toBeNull(); expect(view.container.querySelector('.foundation-watermark')).toBeNull();
    act(() => { scene.manager.update({ general: { watermark: true, watermarkText: '   ' } }); });
    expect(view.container.querySelector('.foundation-watermark')).toBeNull();
  } finally { await scene.dispose(); }
});

it('honors route title, independent pending indicators and every transition style', async () => {
  const scene = await preferenceScene({ general: { dynamicTitle: true }, transition: { enabled: true, loading: true, progress: true, style: 'fade' } });
  const previous = document.title;
  try {
    const content = (pending: boolean) => <RoutePresentation title="Records" appTitle="Example" generation="records"><RouteMotion identity="records" refreshNonce={0}>{pending ? <RoutePending /> : <h1>Records</h1>}</RouteMotion></RoutePresentation>;
    const view = scene.mount(content(true));
    expect(document.title).toBe('Records · Example');
    expect(screen.getByRole('progressbar', { name: 'Page navigation in progress' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Loading page');
    expect(view.container.querySelector('[data-route-motion]')).toHaveClass('route-entry');
    expect(view.container.querySelector('[data-route-motion]')).not.toHaveClass('route-entry-fade');
    act(() => { scene.manager.update({ transition: { loading: false } }); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument(); expect(screen.getByRole('progressbar')).toBeVisible();
    act(() => { scene.manager.update({ transition: { loading: true, progress: false }, general: { dynamicTitle: false } }); });
    expect(screen.getByRole('status')).toBeVisible(); expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(); expect(document.title).toBe('Example');
    view.rerender(content(false));
    for (const style of ['fade', 'fade-down', 'fade-slide', 'fade-up'] as const) {
      act(() => { scene.manager.update({ transition: { style, enabled: true } }); });
      expect(view.container.querySelector('[data-route-motion]')).toHaveClass(`route-entry-${style}`);
    }
    act(() => { scene.manager.update({ transition: { enabled: false } }); });
    expect(view.container.querySelector('[data-route-motion]')).toHaveAttribute('data-route-motion', 'none');
    expect(view.container.querySelector('[data-route-motion]')).toHaveClass('route-entry', { exact: true });
  } finally { await scene.dispose(); }
  expect(document.title).toBe(previous);
});

it('gates copying at the real drawer and exports validated current configuration through the public serializer', async () => {
  const scene = await preferenceScene({ general: { copyPreferences: false } });
  let copied = '';
  try {
    scene.mount(<ManagedPreferenceDrawer extensions={[]} configuration={() => [{ namespace: 'sample.cards', version: 1, value: { private: 'discard' }, validate: () => ({ layout: 'wide' }) }]} clipboard={{ writeText: async text => { copied = text; } }} onClose={() => {}} returnFocus={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Copy effective configuration' })).not.toBeInTheDocument();
    act(() => { scene.manager.update({ general: { copyPreferences: true }, theme: { mode: 'dark' } }); });
    fireEvent.click(screen.getByRole('button', { name: 'Copy effective configuration' }));
    await waitFor(() => expect(copied).not.toBe(''));
    expect(JSON.parse(copied)).toMatchObject({ schemaVersion: 1, core: { general: { copyPreferences: true }, theme: { mode: 'dark' } }, extensions: { 'sample.cards': { version: 1, value: { layout: 'wide' } } } });
    expect(copied).not.toContain('discard');
    act(() => { scene.manager.update({ general: { copyPreferences: false } }); });
    expect(screen.queryByRole('button', { name: 'Copy effective configuration' })).not.toBeInTheDocument();
  } finally { await scene.dispose(); }
});

it('formats instants with explicit preference locale and display zone while retaining read-context facts', async () => {
  const scene = await preferenceScene({ locale: 'en-US', general: { displayTimeZone: 'UTC' } });
  function Instant() { const { core } = usePreferenceSnapshot(); return <output>{formatInstant('2026-10-10T23:30:00Z', { locale: core.locale, timeZone: core.general.displayTimeZone })}</output>; }
  try {
    scene.mount(<Instant />);
    expect(screen.getByRole('status')).toHaveTextContent('Oct 10, 2026, 23:30:00 · UTC');
    act(() => { scene.manager.update({ general: { displayTimeZone: 'Asia/Shanghai' } }); });
    expect(screen.getByRole('status')).toHaveTextContent('Oct 11, 2026, 07:30:00 · Asia/Shanghai');
    act(() => { scene.manager.update({ locale: 'zh-CN' }); });
    expect(screen.getByRole('status')).toHaveTextContent('2026年10月11日 07:30:00 · Asia/Shanghai');
    expect(scene.stores.workspace.getSnapshot().readContext).toEqual(context);
  } finally { await scene.dispose(); }
});

it('consumes locale updates through the actual playground startup subscription and active resources', async () => {
  const fixture = await mountPlayground();
  try {
    expect(await screen.findByRole('heading', { name: '公共首页' })).toBeVisible();
    await act(async () => { fixture.runtime.preferences.update({ locale: 'en-US' }); });
    expect(await screen.findByRole('heading', { name: 'Public home' })).toBeVisible();
    expect(fixture.runtime.i18n.getSnapshot()).toMatchObject({ preferredLocale: 'en-US', activeLocale: 'en-US', status: 'ready' });
    await act(async () => { fixture.runtime.preferences.update({ locale: 'zh-CN' }); });
    expect(await screen.findByRole('heading', { name: '公共首页' })).toBeVisible();
    expect(fixture.runtime.i18n.getSnapshot()).toMatchObject({ activeLocale: 'zh-CN', status: 'ready' });
  } finally { await fixture.dispose(); }
});

it('consumes every appearance preference through the live playground theme subscription', async () => {
  const fixture = await mountPlayground();
  try {
    await screen.findByRole('heading', { name: '公共首页' });
    act(() => { fixture.runtime.preferences.update({ density: 'compact', theme: { mode: 'light', preset: 'custom', colorPrimary: '#123456', radius: 0.75, fontSize: 20, semiDarkSidebar: true, semiDarkSubmenu: true, semiDarkHeader: true, colorWeak: true, grayscale: true } }); });
    const target = document.documentElement;
    expect(target.dataset).toMatchObject({ theme: 'light', density: 'compact', themePreset: 'custom', semiDarkSidebar: 'true', semiDarkSubmenu: 'true', semiDarkHeader: 'true', colorWeak: 'true', grayscale: 'true' });
    expect(target.style.getPropertyValue('--primary')).toBe('#123456');
    expect(target.style.getPropertyValue('--radius')).toBe('0.75rem');
    expect(target.style.getPropertyValue('--font-size-base')).toBe('20px');
    expect(target.style.getPropertyValue('--presentation-filter')).toBe('grayscale(1) invert(1)');
    act(() => { fixture.runtime.preferences.update({ density: 'standard', theme: { mode: 'dark', preset: 'default', colorPrimary: '#654321', radius: 0.25, fontSize: 15, semiDarkSidebar: false, semiDarkSubmenu: false, semiDarkHeader: false, colorWeak: false, grayscale: false } }); });
    expect(target.dataset).toMatchObject({ theme: 'dark', density: 'standard', themePreset: 'default', semiDarkSidebar: 'false', semiDarkSubmenu: 'false', semiDarkHeader: 'false', colorWeak: 'false', grayscale: 'false' });
    expect(target.style.getPropertyValue('--primary')).toBe('#006be6');
    expect(target.style.getPropertyValue('--radius')).toBe('0.25rem');
    expect(target.style.getPropertyValue('--font-size-base')).toBe('15px');
    expect(target.style.getPropertyValue('--presentation-filter')).toBe('none');
    act(() => { fixture.runtime.preferences.update({ theme: { preset: 'custom' } }); });
    expect(target.style.getPropertyValue('--primary')).toBe('#654321');
  } finally { await fixture.dispose(); }
});

it('applies all four shortcut preferences to the real dispatcher without swallowing unrelated keys', async () => {
  const scene = await preferenceScene();
  const target = new EventTarget(), events: string[] = [];
  const actions = { search: () => events.push('search'), preferences: () => events.push('preferences'), cancelOverlay: () => { events.push('escape'); return true; } };
  const runtime = createShortcutRuntime({ target, platform: 'Linux', preferences: scene.manager.getSnapshot().core.shortcut, actions });
  const unsubscribe = scene.manager.subscribe(() => runtime.update({ platform: 'Linux', preferences: scene.manager.getSnapshot().core.shortcut, actions }));
  const send = () => { for (const [key, ctrlKey] of [['k', true], [',', true], ['Escape', false]] as const) target.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, cancelable: true })); };
  try {
    for (const [patch, expected] of [
      [{ enabled: true, globalSearch: true, globalPreferences: true, globalEscape: true }, ['search', 'preferences', 'escape']],
      [{ enabled: false }, []],
      [{ enabled: true, globalSearch: false }, ['preferences', 'escape']],
      [{ globalSearch: true, globalPreferences: false }, ['search', 'escape']],
      [{ globalPreferences: true, globalEscape: false }, ['search', 'preferences']],
    ] as const) {
      scene.manager.update({ shortcut: patch }); events.length = 0; send(); expect(events).toEqual(expected);
    }
    const unrelated = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true, cancelable: true });
    target.dispatchEvent(unrelated); expect(unrelated.defaultPrevented).toBe(false);
  } finally { unsubscribe(); runtime.dispose(); await scene.dispose(); }
});
