import { describe, expect, it } from 'vitest';
import type { DomainModule, RouteMeta } from '@niubu/core-typings';
import * as access from './index';

type Page = RouteMeta<'team'> & { view?: string };
const page = (id: string, path = `/${id}`, order = 1, view?: string): Page => ({
  id, path, order, view, titleKey: id, iconToken: 'list', navigation: true,
  scope: 'team', capability: 'records.read',
});
const load = async () => ({ Component: 'record-view' });
const module = (id: string, routes: readonly Page[]): DomainModule<Page, string> => ({
  id, routes, loaders: Object.fromEntries(routes.map(route => [route.path, load])),
  menus: routes.filter(route => route.navigation).map(route => ({ pageId: route.id })),
  permissions: ['records.read'], namespaces: ['common', id],
});

describe('module registry', () => {
  it('merges independently declared modules by route order with original stable ids and path loaders', async () => {
    const registry = access.createModuleRegistry([
      module('alpha', [page('later', '/shared', 20, 'grid')]),
      { ...module('beta', [page('first', '/shared', 10, 'list')]), permissions: ['records.read', 'records.write'] },
    ]);
    expect(registry.pageIds).toEqual(['first', 'later']);
    expect(registry.routes.map(route => route.view)).toEqual(['list', 'grid']);
    expect(Object.keys(registry.loaders)).toEqual(['/shared']);
    expect(await registry.loaders['/shared']!()).toEqual({ Component: 'record-view' });
    expect(registry.menus).toEqual([{ pageId: 'later' }, { pageId: 'first' }]);
    expect(registry.permissions).toEqual(['records.read', 'records.write']);
    expect(registry.namespaces).toEqual(['common', 'alpha', 'beta']);
  });
  it('owns frozen output collections without freezing the caller arrays', () => {
    const source = module('alpha', [page('records')]);
    const registry = access.createModuleRegistry([source]);
    for (const value of [registry, registry.routes, registry.pageIds, registry.loaders, registry.menus,
      registry.menus[0], registry.permissions, registry.namespaces]) expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(source.routes)).toBe(false);
  });
  it('keeps menu parent declarations for registered pages across modules', () => {
    const registry = access.createModuleRegistry([
      module('alpha', [page('parent')]),
      { ...module('beta', [page('child')]), menus: [{ pageId: 'child', parentId: 'parent' }] },
    ]);
    expect(registry.menus).toEqual([{ pageId: 'parent' }, { pageId: 'child', parentId: 'parent' }]);
  });
  it('rejects duplicate module ids with the offending id', () => {
    expect(() => access.createModuleRegistry([module('alpha', []), module('alpha', [])]))
      .toThrow(/duplicate module id: alpha/i);
  });
  it('rejects duplicate page ids even when their paths differ', () => {
    expect(() => access.createModuleRegistry([module('alpha', [page('same')]), module('beta', [page('same', '/other')])]))
      .toThrow(/duplicate page id: same/i);
  });
  it('rejects a repeated path and view identity', () => {
    expect(() => access.createModuleRegistry([module('alpha', [page('a', '/shared')]), module('beta', [page('b', '/shared')])]))
      .toThrow(/duplicate route identity.*shared/i);
  });
  it('rejects conflicting loaders on a shared path instead of replacing the first', () => {
    expect(() => access.createModuleRegistry([
      module('alpha', [page('a', '/shared', 1, 'grid')]),
      { ...module('beta', [page('b', '/shared', 2, 'list')]), loaders: { '/shared': async () => ({ Component: 'other' }) } },
    ])).toThrow(/conflicting loader.*\/shared/i);
  });
  it.each(['pageId', 'parentId'] as const)('rejects an unknown menu %s after all pages are registered', key => {
    expect(() => access.createModuleRegistry([
      { ...module('alpha', [page('known')]), menus: [{ pageId: 'known', [key]: 'missing' }] },
    ])).toThrow(/unknown.*page.*missing/i);
  });
});
