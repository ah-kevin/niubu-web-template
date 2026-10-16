import { expect, it } from 'vitest';
import type { ReadContext, RouteMeta, ScopeRef } from '@niubu/core-typings';
import { canAccess, projectRoutes, requestedScope, sameScope, type AccessSnapshot } from './index';
const kinds = ['region', 'team'] as const;
type ScopeKind = (typeof kinds)[number];
const scope: ScopeRef<ScopeKind> = { kind: 'region', id: 'a' };
const access: AccessSnapshot<ScopeKind> = { scopes: [scope], capabilities: ['read'] };
it('projects only the passed registry and gates capability before account bypass', () => {
  const routes = [
    { id: 'a', scope: 'region' as const, capability: 'read' },
    { id: 'b', scope: 'account' as const, capability: 'admin' },
  ];
  expect(projectRoutes(routes, access, scope)).toEqual([routes[0]]);
  expect(canAccess(routes[1], access, null)).toBe(false);
  expect(canAccess(routes[0], access, { kind: 'team', id: 'a' })).toBe(false);
  expect(canAccess(routes[0], access, { kind: 'region', id: 'missing' })).toBe(false);
  expect(canAccess(routes[0], access, null)).toBe(false);
  expect(canAccess({ scope: 'public', capability: null }, access, null)).toBe(true);
  expect(canAccess({ scope: 'account', capability: 'read' }, access, null)).toBe(true);
});
it('compares both scope kind and id and rejects absent scopes', () => {
  expect(sameScope(scope, { kind: 'region', id: 'a' })).toBe(true);
  expect(sameScope(scope, { kind: 'team', id: 'a' })).toBe(false);
  expect(sameScope(scope, { kind: 'region', id: 'b' })).toBe(false);
  expect(sameScope(null, null)).toBe(false);
});
it('accepts registered kinds matching the active read context', () => {
  const context: ReadContext<ScopeKind> = { scope, businessDate: '2026-10-11', timeZone: 'Asia/Shanghai' };
  const route: RouteMeta<ScopeKind> = {
    id: 'region', path: '/records', titleKey: 'records', iconToken: 'list', order: 1,
    navigation: true, scope: 'region', capability: 'read',
  };
  expect(requestedScope('?scopeKind=region&scopeId=a', context.scope, kinds)).toEqual({ scope, valid: true });
  expect(requestedScope('?scopeKind=team&scopeId=t1', { kind: 'team', id: 't1' }, kinds))
    .toEqual({ scope: { kind: 'team', id: 't1' }, valid: true });
  expect(projectRoutes([route], access, context.scope)).toEqual([route]);
});
it('rejects kinds the app did not register, including reserved route scopes', () => {
  for (const kind of ['public', 'account', 'site']) {
    expect(requestedScope(`?scopeKind=${kind}&scopeId=a`, scope, kinds)).toEqual({ scope: null, valid: false });
    expect(requestedScope(`?scopeKind=${kind}&scopeId=a`, null, kinds)).toEqual({ scope: null, valid: false });
  }
  expect(requestedScope('?scopeKind=region&scopeId=a', scope, ['team'])).toEqual({ scope: null, valid: false });
});
it('rejects malformed explicit scope instead of selecting the active default', () => {
  for (const search of [
    '?scopeId=a',
    '?scopeKind=region',
    '?scopeKind=&scopeId=a',
    '?scopeKind=region&scopeId=',
    '?scopeKind=region&scopeId=a&scopeId=a',
    '?scopeKind=region&scopeKind=region&scopeId=a',
  ])
    expect(requestedScope(search, scope, kinds)).toEqual({ scope: null, valid: false });
});
it('retains the parsed scope but rejects a registered kind outside the active context', () => {
  expect(requestedScope('?scopeKind=region&scopeId=b', scope, kinds))
    .toEqual({ scope: { kind: 'region', id: 'b' }, valid: false });
  expect(requestedScope('?scopeKind=region&scopeId=a', null, kinds)).toEqual({ scope, valid: false });
});
it('keeps the active scope when the URL has no scope metadata', () => {
  expect(requestedScope('', scope, kinds)).toEqual({ scope, valid: true });
  expect(requestedScope('?page=2', { kind: 'team', id: 't1' }, kinds))
    .toEqual({ scope: { kind: 'team', id: 't1' }, valid: true });
  expect(requestedScope('', null, kinds)).toEqual({ scope: null, valid: true });
});
