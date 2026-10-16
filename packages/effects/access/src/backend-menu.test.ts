import { describe, expect, it } from 'vitest';
import type { BackendMenuItem, RouteMeta } from '@niubu/core-typings';
import * as access from './index';

const north = { kind: 'team', id: 'north' };
const page = (id: string, extra: Partial<RouteMeta> = {}): RouteMeta => ({
  id, path: `/${id}`, titleKey: `title.${id}`, iconToken: 'file', order: 0,
  navigation: true, scope: 'team', capability: 'read', ...extra,
});
const routes = [page('home', { scope: 'public' }), page('records'), page('hidden', { hideInMenu: true }),
  page('admin', { requiredRoles: ['admin', 'owner'], requiredCodes: ['read', 'write'] }),
  page('escape', { ignoreAccess: true })];
const options = (extra: Partial<access.ResolveAccessOptions> = {}): access.ResolveAccessOptions => ({
  mode: 'frontend', routes, access: { scopes: [north], capabilities: ['read'] },
  roles: ['owner'], codes: ['read', 'write'], scope: north, authenticated: true,
  baseURL: 'https://app.example/root/', ...extra,
});
const backend: readonly BackendMenuItem[] = [{ kind: 'group', id: 'tools', title: 'Tools', children: [
  { kind: 'page', id: 'r', pageId: 'records', title: 'Server records', icon: 'server', badge: 3, order: 2 },
  { kind: 'page', id: 'a', pageId: 'admin', order: 1 },
  { kind: 'page', id: 'h', pageId: 'hidden', hidden: true },
] }];

describe('resolveAccess', () => {
  it('filters frontend capabilities, membership, roles-any and codes-all independently', () => {
    expect(access.resolveAccess(options()).grantedPageIds).toEqual(['home', 'records', 'hidden', 'admin', 'escape']);
    expect(access.resolveAccess(options({ roles: ['reader'] })).grantedPageIds).not.toContain('admin');
    expect(access.resolveAccess(options({ codes: ['read'] })).grantedPageIds).not.toContain('admin');
    expect(access.resolveAccess(options({ access: { scopes: [north], capabilities: [] } })).grantedPageIds)
      .toEqual(['home', 'escape']);
    for (const scope of [null, { kind: 'team', id: 'stranger' }, { kind: 'region', id: 'north' }]) {
      expect(access.resolveAccess(options({ scope })).grantedPageIds).toEqual(['home', 'escape']);
    }
    expect(access.resolveAccess(options({ authenticated: false })).grantedPageIds).toEqual(['home', 'escape']);
  });
  it('keeps menu visibility separate from grants and respects explicit frontend menu selection', () => {
    const result = access.resolveAccess(options({ frontendMenu: [{ pageId: 'records' }] }));
    expect(result.menu).toMatchObject([{ kind: 'page', id: 'records', title: 'title.records', icon: 'file', href: '/records?scopeKind=team&scopeId=north' }]);
    expect(result.grantedPageIds).toContain('hidden');
    expect(access.resolveAccess(options()).menu.some(item => item.id === 'hidden')).toBe(false);
  });
  it('selects only registered backend pages, preserves nesting/order, and defaults presentation from code', () => {
    const result = access.resolveAccess(options({ mode: 'backend', backendMenu: backend }));
    expect(result.grantedPageIds).toEqual(['home', 'records', 'hidden', 'admin', 'escape']);
    expect(result.menu).toMatchObject([{ kind: 'group', id: 'tools', children: [
      { kind: 'page', id: 'a', pageId: 'admin', title: 'title.admin', icon: 'file' },
      { kind: 'page', id: 'r', title: 'Server records', icon: 'server', badge: 3 },
    ] }]);
    expect(access.resolveAccess(options({ mode: 'backend', backendMenu: backend, roles: [] })).grantedPageIds).not.toContain('admin');
    expect(access.resolveAccess(options({ mode: 'backend', backendMenu: backend,
      access: { scopes: [north], capabilities: [] } })).grantedPageIds).toEqual(['home', 'escape']);
    expect(access.resolveAccess(options({ mode: 'backend', backendMenu: backend,
      scope: { kind: 'team', id: 'stranger' } })).grantedPageIds).toEqual(['home', 'escape']);
  });
  it('does not retain protected grants across empty/failed backend snapshots; code exceptions remain', () => {
    access.resolveAccess(options({ mode: 'backend', backendMenu: backend }));
    for (const backendMenu of [undefined, []])
      for (const authenticated of [true, false]) {
        const result = access.resolveAccess(options({ mode: 'backend', backendMenu, authenticated }));
        expect(result.grantedPageIds).toEqual(['home', 'escape']);
        expect(result.menu).toEqual([]);
      }
  });
  it('uses backend display priority in mixed mode, dedupes page ids, and preserves frontend-only pages', () => {
    const result = access.resolveAccess(options({ mode: 'mixed', backendMenu: backend }));
    expect(result.menu[0]).toMatchObject({ kind: 'group', id: 'tools' });
    const serialized = JSON.stringify(result.menu);
    expect(serialized.match(/"pageId":"records"/g)).toHaveLength(1);
    expect(serialized).toContain('Server records');
    expect(result.menu.some(node => node.id === 'home')).toBe(true);
    expect(result.grantedPageIds).toContain('hidden');
  });
  it('diagnoses duplicate ids, duplicate page selections and unknown pages without breaking valid siblings', () => {
    const result = access.resolveAccess(options({ mode: 'backend', backendMenu: [
      { kind: 'page', id: 'one', pageId: 'records' },
      { kind: 'page', id: 'one', pageId: 'admin' },
      { kind: 'page', id: 'other', pageId: 'records' },
      { kind: 'page', id: 'unknown', pageId: 'missing' },
      { kind: 'page', id: 'valid', pageId: 'admin' },
    ] }));
    expect(result.menu.map(node => node.id)).toEqual(['one', 'valid']);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-id', id: 'one' }),
      expect.objectContaining({ code: 'duplicate-page', id: 'other', pageId: 'records' }),
      expect.objectContaining({ code: 'unknown-page', id: 'unknown', pageId: 'missing' }),
    ]));
  });
  it('cannot override registry URLs, loaders, constraints or leak unrecognized DTO fields', () => {
    const item = { kind: 'page' as const, id: 'r', pageId: 'records', href: 'https://evil.example', path: '/evil',
      loader: 'malicious', scope: 'public' };
    const result = access.resolveAccess(options({ mode: 'backend', backendMenu: [item] }));
    expect(result.menu[0]).toMatchObject({ href: '/records?scopeKind=team&scopeId=north' });
    expect(JSON.stringify(result)).not.toMatch(/evil|malicious/);
    expect(access.resolveAccess(options({ mode: 'backend', backendMenu: [item], authenticated: false })).grantedPageIds)
      .not.toContain('records');
  });
  it('projects safe backend external/iframe nodes only with authenticated, valid scope', () => {
    const items: BackendMenuItem[] = [
      { kind: 'external', id: 'docs', title: 'Docs', href: 'https://docs.example/', openInNewWindow: true },
      { kind: 'iframe', id: 'frame', title: 'Frame', src: '/embed?view=1' },
      { kind: 'external', id: 'relative', title: 'Local', href: '../help' },
    ];
    const result = access.resolveAccess(options({ mode: 'backend', backendMenu: items }));
    expect(result.menu).toHaveLength(3);
    expect(result.menu[0]).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' });
    expect(result.iframeItems).toMatchObject([{ id: 'frame', src: '/embed?view=1' }]);
    for (const extra of [{ authenticated: false }, { scope: { kind: 'team', id: 'other' } }]) {
      const denied = access.resolveAccess(options({ mode: 'backend', backendMenu: items, ...extra }));
      expect(denied.menu).toEqual([]);
      expect(denied.iframeItems).toEqual([]);
    }
    expect(access.resolveAccess(options({ mode: 'backend', backendMenu: items, scope: null })).menu).toHaveLength(3);
    expect(access.resolveAccess(options({ backendMenu: items })).iframeItems).toEqual([]);
  });
  it.each(['//evil.example', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://host/path', '\\evil.example',
    '/\\evil.example', 'https:evil.example', 'https://', '\nhttps://evil.example'])('rejects unsafe URL %j', url => {
    const result = access.resolveAccess(options({ mode: 'backend', backendMenu: [
      { kind: 'external', id: 'external', title: 'Bad', href: url },
      { kind: 'iframe', id: 'iframe', title: 'Bad', src: url },
    ] }));
    expect(result.menu).toEqual([]);
    expect(result.iframeItems).toEqual([]);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.every(item => item.code === 'unsafe-url')).toBe(true);
  });
  it('grants descendants of a hidden group but suppresses all their visual and iframe projections', () => {
    const result = access.resolveAccess(options({ mode: 'mixed', backendMenu: [
      { kind: 'group', id: 'hidden-group', title: 'Hidden', hidden: true, children: [
        { kind: 'page', id: 'r', pageId: 'records' },
        { kind: 'iframe', id: 'f', title: 'Frame', src: '/frame' },
      ] },
    ] }));
    expect(result.grantedPageIds).toContain('records');
    expect(JSON.stringify(result.menu)).not.toContain('"pageId":"records"');
    expect(result.iframeItems).toEqual([]);
  });
  it('copies frozen output and optional code metadata without freezing caller objects', () => {
    const route = page('records', { fixedTab: true, hideInTabs: true, hideInBreadcrumbs: true,
      activePath: '/records', badge: 'new', openInNewWindow: true });
    const result = access.resolveAccess(options({ routes: [route] }));
    expect(result.menu[0]).toMatchObject({ fixedTab: true, hideInTabs: true, hideInBreadcrumbs: true,
      activePath: '/records', badge: 'new', target: '_blank', rel: 'noopener noreferrer' });
    for (const value of [result, result.menu, result.menu[0], result.grantedPageIds, result.iframeItems, result.diagnostics])
      expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(route)).toBe(false);
  });
});

it('preserves frontend parent links and promotes authorized children when their parent is denied', () => {
  const input = options({ routes: [page('parent'), page('child')], frontendMenu: [
    { pageId: 'parent' }, { pageId: 'child', parentId: 'parent' },
  ] });
  expect(access.resolveAccess(input).menu).toMatchObject([{ kind: 'group', id: 'group:parent', children: [
    { kind: 'page', pageId: 'parent', href: '/parent?scopeKind=team&scopeId=north' },
    { kind: 'page', pageId: 'child' },
  ] }]);
  expect(access.resolveAccess({ ...input, routes: [page('parent', { requiredCodes: ['missing'] }), page('child')] }).menu)
    .toMatchObject([{ kind: 'page', pageId: 'child' }]);
});
it('diagnoses malformed frontend declarations and duplicate registry IDs without losing unrelated pages', () => {
  const result = access.resolveAccess(options({ routes: [page('a'), page('a', { path: '/override' }), page('b'), page('valid')],
    frontendMenu: [{ pageId: 'a', parentId: 'b' }, { pageId: 'b', parentId: 'a' }, { pageId: 'missing' },
      { pageId: 'valid' }, { pageId: 'valid' }] }));
  expect(result.menu).toMatchObject([{ pageId: 'valid' }]);
  expect(result.diagnostics.map(item => item.code)).toEqual(expect.arrayContaining([
    'duplicate-route', 'unknown-page', 'duplicate-page', 'cyclic-parent',
  ]));
});
it('does not emit duplicate IDs when a generated frontend group conflicts with a backend item', () => {
  const result = access.resolveAccess(options({ mode: 'mixed', routes: [page('parent'), page('child')],
    frontendMenu: [{ pageId: 'parent' }, { pageId: 'child', parentId: 'parent' }],
    backendMenu: [{ kind: 'external', id: 'group:parent', title: 'Backend', href: '/docs' }] }));
  expect(result.menu.map(node => node.id)).toEqual(['group:parent', 'parent', 'child']);
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'duplicate-id', id: 'group:parent' }));
});
it('honors explicit backend new-window false over code defaults and copies nested immutable output', () => {
  const source: BackendMenuItem[] = [{ kind: 'group', id: 'group', title: 'Group', children: [
    { kind: 'page', id: 'r', pageId: 'records', openInNewWindow: false },
  ] }];
  const result = access.resolveAccess(options({ mode: 'backend', routes: [page('records', { openInNewWindow: true })], backendMenu: source }));
  const group = result.menu[0];
  expect(group?.kind).toBe('group');
  if (group?.kind !== 'group') throw new Error('Expected projected group');
  expect(group.children[0]).toMatchObject({ openInNewWindow: false });
  expect(group.children[0]).not.toHaveProperty('target');
  for (const value of [group, group.children, group.children[0]]) expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(source[0])).toBe(false);
  source[0] = { kind: 'page', id: 'changed', pageId: 'admin' };
  expect(group.children[0]?.id).toBe('r');
});
it('fails closed for external content when baseURL is not a valid HTTP(S) application URL', () => {
  for (const baseURL of ['invalid', 'file:///tmp/app']) {
    const result = access.resolveAccess(options({ mode: 'backend', baseURL,
      backendMenu: [{ kind: 'iframe', id: 'frame', title: 'Frame', src: '/embed' }] }));
    expect(result.iframeItems).toEqual([]);
    expect(result.diagnostics).toContainEqual({ code: 'unsafe-url', id: 'frame' });
  }
});
