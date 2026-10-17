import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resolveAccess } from '@niubu/access';
import type { BackendMenuItem } from '@niubu/types';
import { BusinessShell } from '@niubu/layouts';
import { createAppStores } from '@niubu/stores';
import { StoresProvider } from '@niubu/stores/react';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks/storage';
import { I18nProvider } from '@niubu/locales/react';
import { appDefaults, appIdentity, appPolicy } from '../app/config';
import { createPlaygroundI18n } from '../locales';
import { registry, selectPublicMenu } from '../modules/demo';
import { icons } from '../icons';
import { projectMenu } from './navigation';

const north = { kind: 'workspace', id: 'north' } as const;
// These selections exercise the app projection, real shell and real TreeNavigation together.
const menu: readonly BackendMenuItem[] = [
  {
    kind: 'group',
    id: 'overview',
    title: 'Overview',
    icon: 'home',
    children: [{ kind: 'page', id: 'home', pageId: 'playground.home' }],
  },
  {
    kind: 'group',
    id: 'examples',
    title: 'Examples',
    icon: 'boxes',
    children: [{ kind: 'page', id: 'forms', pageId: 'playground.examples.forms' }],
  },
  {
    kind: 'group',
    id: 'features',
    title: 'Features',
    icon: 'wrench',
    children: [
      {
        kind: 'group',
        id: 'network',
        title: 'Network',
        icon: 'globe',
        children: [
          { kind: 'page', id: 'query', pageId: 'playground.examples.query' },
          { kind: 'page', id: 'request', pageId: 'playground.request', badge: 'Demo' },
          {
            kind: 'external',
            id: 'docs',
            title: 'Documentation',
            href: 'https://example.com/docs',
            openInNewWindow: true,
          },
          { kind: 'iframe', id: 'frame', title: 'Frame', src: '/frame-demo.html' },
          { kind: 'page', id: 'unknown', pageId: 'unknown.page' },
        ],
      },
      {
        kind: 'group',
        id: 'application',
        title: 'Application',
        icon: 'layout-grid',
        children: [
          { kind: 'page', id: 'tabs', pageId: 'playground.examples.tabs' },
          { kind: 'page', id: 'detail', pageId: 'playground.examples.tab-detail', hidden: true },
        ],
      },
    ],
  },
];
function access(
  codes: readonly string[] = ['demo:read'],
  scopes: readonly (typeof north)[] = [north],
  scope: typeof north | null = north,
  authenticated = true,
) {
  return resolveAccess({
    mode: 'backend',
    routes: registry.routes,
    backendMenu: menu,
    access: { scopes, capabilities: codes },
    roles: [],
    codes,
    scope,
    authenticated,
    baseURL: 'https://playground.invalid',
  });
}
const disposers: (() => void)[] = [];
afterEach(() => {
  cleanup();
  disposers
    .splice(0)
    .reverse()
    .forEach(dispose => dispose());
});
function mount(pathname = '/examples/query') {
  const stores = createAppStores({ identityKey: 'navigation-test', readContext: null });
  const preferences = createPreferenceManager({
    identity: { ...appIdentity, identityKey: 'navigation-test' },
    appDefaults: {
      ...appDefaults,
      layout: { mode: 'vertical' },
      menu: { accordion: true },
      sidebar: { collapsed: false },
    },
    policy: appPolicy,
    storage: createStoragePort({ getItem: () => null, setItem: () => {} }),
  });
  const i18n = createPlaygroundI18n('en-US', { lang: 'en-US', dir: 'ltr' });
  function Scene({ path }: { path: string }) {
    return (
      <StoresProvider stores={stores}>
        <PreferenceProvider manager={preferences}>
          <I18nProvider instance={i18n}>
            <BusinessShell
              brand="Navigation test"
              navigationKey={path}
              navigation={projectMenu(access().menu, path, north, key => key)}
              renderLink={({ external: _external, ...props }) => <a {...props} />}
            >
              Content
            </BusinessShell>
          </I18nProvider>
        </PreferenceProvider>
      </StoresProvider>
    );
  }
  const view = render(<Scene path={pathname} />);
  disposers.push(() => {
    i18n.dispose();
    preferences.dispose();
    stores.dispose();
  });
  return { preferences, reroute: (path: string) => view.rerender(<Scene path={path} />) };
}

describe('backend menu projected into the real disclosure navigation', () => {
  it('opens current child ancestors, folds and expands a branch with icons and depth indentation', () => {
    mount();
    const features = screen.getByRole('button', { name: 'Features' });
    const network = screen.getByRole('button', { name: 'Network' });
    expect(features).toHaveAttribute('aria-expanded', 'true');
    expect(network).toHaveAttribute('aria-expanded', 'true');
    expect(features).toHaveClass('active-parent');
    expect(network).toHaveClass('active-parent');
    const query = screen.getByRole('link', { name: 'app:examples.query' });
    expect(query).toHaveAttribute('aria-current', 'page');
    expect(query).toHaveAttribute('href', '/examples/query?scopeKind=workspace&scopeId=north');
    expect(query.closest('ul')).toHaveAttribute('data-depth', '2');
    expect(query.closest('ul')).toHaveStyle({ '--navigation-indent': '36px' });
    expect(features.querySelector('svg.lucide-wrench')).not.toBeNull();
    expect(query.querySelector('svg.lucide-database')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'app:examples.forms' })).not.toBeInTheDocument();
    fireEvent.click(network);
    expect(network).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'app:examples.query' })).not.toBeInTheDocument();
    fireEvent.click(network);
    expect(screen.getByRole('link', { name: 'app:examples.query' })).toHaveAttribute('aria-current', 'page');
  });
  it('applies sibling accordion at both depths and honors the existing disabled preference', () => {
    const scene = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Application' }));
    expect(screen.getByRole('button', { name: 'Features' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Network' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'app:examples.tabs' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Examples' }));
    expect(screen.getByRole('button', { name: 'Features' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'app:examples.forms' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Application' })).not.toBeInTheDocument();
    act(() => {
      scene.preferences.update({ menu: { accordion: false } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Features' }));
    expect(screen.getByRole('button', { name: 'Examples' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'app:examples.forms' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'app:examples.tabs' })).toBeVisible();
  });
  it('reopens the new current page ancestors when the navigation key changes', () => {
    const scene = mount('/home');
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Features' })).toHaveAttribute('aria-expanded', 'false');
    scene.reroute('/examples/query');
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Features' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Network' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'app:examples.query' })).toHaveAttribute('aria-current', 'page');
  });
  it('retains safe external targets, frame scope, badges and unknown-id diagnostics', () => {
    mount();
    const docs = screen.getByRole('link', { name: 'Documentation' });
    expect(docs).toHaveAttribute('href', 'https://example.com/docs');
    expect(docs).toHaveAttribute('target', '_blank');
    expect(docs).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Frame' })).toHaveAttribute(
      'href',
      '/embedded/frame?scopeKind=workspace&scopeId=north',
    );
    expect(screen.getByRole('link', { name: 'app:request Demo' })).toHaveAttribute(
      'href',
      '/request?scopeKind=workspace&scopeId=north',
    );
    expect(access().diagnostics).toEqual([{ code: 'unknown-page', id: 'unknown', pageId: 'unknown.page' }]);
    expect(screen.queryByText('unknown.page')).not.toBeInTheDocument();
    expect(screen.queryByText('app:examples.tabDetail')).not.toBeInTheDocument();
  });
  it('keeps backend page selection, code gates, hidden-detail grants and empty scopes authoritative', () => {
    expect(access().grantedPageIds).toContain('playground.examples.tab-detail');
    expect(access().grantedPageIds).not.toContain('playground.examples.tables');
    expect(access([]).grantedPageIds).not.toContain('playground.examples.query');
    for (const [result, homeHref] of [
      [access(['demo:read'], [], north), '/home?scopeKind=workspace&scopeId=north'],
      [access(['demo:read'], [north], null), '/home'],
      [access([], [], null, false), '/home'],
    ] as const) {
      expect(result.grantedPageIds).toEqual(['playground.home', 'playground.login']);
      const projected = projectMenu(result.menu, '/home', null, key => key);
      expect(projected[0]).toMatchObject({ id: 'overview', children: [{ id: 'home', href: homeHref, active: true }] });
      expect(result.diagnostics).toEqual([{ code: 'unknown-page', id: 'unknown', pageId: 'unknown.page' }]);
    }
    expect(selectPublicMenu(['playground.home', 'playground.request', 'unknown.page']).map(route => route.id)).toEqual([
      'playground.home',
    ]);
  });
  it('localizes group titles without changing branch identity or child selection', () => {
    const nodes = projectMenu(
      [{ kind: 'group', id: 'localized', title: 'app:navigation.features', children: [] }],
      '/home',
      null,
      key => (key === 'app:navigation.features' ? '功能演示' : key),
    );
    expect(nodes[0]).toMatchObject({ kind: 'branch', id: 'localized', label: '功能演示', children: [] });
    expect(icons.resolve('database')).not.toBe(icons.resolve('unknown-token'));
  });
});
