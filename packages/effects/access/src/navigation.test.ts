import { expect, it } from 'vitest';
import * as access from './index';
import type { RouteMeta } from '@niubu/core-typings';

type Page = RouteMeta<'team'> & { domain: string; groupKey: string; view?: string; titleParams?: { titleKey: string } };
const page = (id: string, path: string, order = 1, extra: Partial<Page> = {}): Page => ({
  id, path, order, domain: 'records', groupKey: 'workspace', titleKey: `page.${id}`,
  iconToken: 'list', navigation: true, scope: 'team', capability: null, ...extra,
});
const options = { domainLabels: { records: 'domain.records', home: 'domain.home' }, homePath: '/start' };
const scope = { kind: 'team', id: 'a/b & c' };

it('projects only supplied visible pages in order using app labels and the longest path owner', () => {
  const routes = [page('detail', '/records/detail', 2), page('list', '/records', 1), page('hidden', '/hidden', 0, { navigation: false })];
  const tree = access.projectBusinessNavigation(routes, { pathname: '/records/detail/one', search: '?private=1' }, scope, options);
  expect(tree).toMatchObject([{ id: 'group:workspace', label: 'workspace', children: [
    { id: 'domain:records', label: 'domain.records', children: [{ id: 'list', active: false }, { id: 'detail', active: true }] },
  ] }]);
  expect(access.flattenNavigation(tree).map(leaf => [leaf.id, leaf.href])).toEqual([
    ['list', '/records?scopeKind=team&scopeId=a%2Fb+%26+c'],
    ['detail', '/records/detail?scopeKind=team&scopeId=a%2Fb+%26+c'],
  ]);
  expect(access.projectBusinessNavigation([], { pathname: '/', search: '' }, null, options)).toEqual([]);
  expect(access.navigationHref(routes[0]!, null)).toBe('/records/detail');
});
it('links only a visible configured home and nearest visible static ancestor', () => {
  const home = page('start', '/start', 0, { domain: 'home' });
  const root = page('list', '/records');
  const pattern = page('pattern', '/records/:id');
  const current = page('edit', '/records/:id/edit', 3, { titleParams: { titleKey: 'record' } });
  const crumbs = access.projectBreadcrumbs(current, null, [home, root, pattern], options);
  expect(crumbs.map(item => [item.id, item.href])).toEqual([
    ['home', '/start'], ['domain:records', undefined], ['list', '/records'], ['edit', undefined],
  ]);
  expect(crumbs.at(-1)).toMatchObject({ current: true, titleParams: { titleKey: 'record' } });
});
it('does not invent a home or expose inaccessible ancestors', () => {
  const current = page('detail', '/records/detail');
  expect(access.projectBreadcrumbs(current, null, [], options).flatMap(item => item.href ? [item.href] : [])).toEqual([]);
  expect(access.projectBreadcrumbs(page('start', '/start', 0, { domain: 'home' }), null, [], options).map(item => item.id))
    .toEqual(['start']);
});
it('does not link wildcard ancestors or route patterns configured as home', () => {
  const current = page('edit', '/records/*/edit');
  const visible = [page('wildcard', '/records/*')];
  expect(access.projectBreadcrumbs(current, null, visible, { ...options, homePath: '/records/*' })
    .flatMap(item => item.href ? [item.href] : [])).toEqual([]);
});
it('falls back to supplied group and domain values when no label exists', () => {
  const current = page('list', '/records');
  const config = { domainLabels: {}, homePath: '/start' };
  expect(access.projectBreadcrumbs(current, null, [], config)[0]?.labelKey).toBe('workspace');
  expect(access.projectBusinessNavigation([current], { pathname: '/', search: '' }, null, config))
    .toMatchObject([{ children: [{ label: 'records' }] }]);
});
