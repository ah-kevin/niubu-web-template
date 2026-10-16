import { expect, expectTypeOf, it } from 'vitest';
import type { RouteAccess, ScopeRef } from '@niubu/core-typings';
import * as access from './index';

const kinds = ['team', 'region'] as const;
type Kind = (typeof kinds)[number];
const a = { kind: 'team', id: 'a' } as const;
const b = { kind: 'team', id: 'b' } as const;
const meta: RouteAccess<Kind> = { scope: 'team', capability: 'records.read' };
const snapshot: access.AccessSnapshot = { scopes: [a, b, { kind: 'region', id: 'r' }], capabilities: ['records.read'] };

it('accepts an explicitly granted registered scope without weakening the strict active parser', () => {
  expect(access.resolveBusinessScope(meta, '?scopeKind=team&scopeId=b', a, snapshot, kinds))
    .toEqual({ allowed: true, scope: b });
  expect(access.requestedScope('?scopeKind=team&scopeId=b', a, kinds).valid).toBe(false);
  expect(access.resolveBusinessScope({ scope: 'account', capability: null }, '?scopeKind=region&scopeId=r', a, snapshot, kinds))
    .toEqual({ allowed: true, scope: { kind: 'region', id: 'r' } });
});
it.each([
  '?scopeId=b', '?scopeKind=team', '?scopeKind=unknown&scopeId=b', '?scopeKind=public&scopeId=a',
  '?scopeKind=account&scopeId=a', '?scopeKind=team&scopeId=', '?scopeKind=team&scopeId=missing',
  '?scopeKind=team&scopeId=b&scopeId=a', '?scopeKind=team&scopeKind=region&scopeId=b',
])('rejects invalid or ungranted explicit scopes without falling back: %s', search => {
  for (const route of [meta, { scope: 'account' as const, capability: null }])
    expect(access.resolveBusinessScope(route, search, a, snapshot, kinds)).toEqual({ allowed: false, state: 'forbidden' });
});
it('checks capabilities, scope kind and membership for content routes', () => {
  expect(access.resolveBusinessScope(meta, '', a, snapshot, kinds)).toEqual({ allowed: true, scope: a });
  expect(access.resolveBusinessScope(meta, '', null, snapshot, kinds)).toEqual({ allowed: false, state: 'no-access' });
  expect(access.resolveBusinessScope(meta, '', a, { ...snapshot, capabilities: [] }, kinds)).toEqual({ allowed: false, state: 'forbidden' });
  expect(access.resolveBusinessScope(meta, '', { kind: 'region', id: 'r' }, snapshot, kinds)).toEqual({ allowed: false, state: 'forbidden' });
  expect(access.resolveBusinessScope(meta, '', { kind: 'team', id: 'missing' }, snapshot, kinds)).toEqual({ allowed: false, state: 'forbidden' });
});
it('retains null scope previews and narrows broad input scopes to registered kinds', () => {
  const active: ScopeRef = { kind: 'unregistered', id: 'a' };
  const result = access.resolveBusinessScope(meta, '', active, snapshot, kinds);
  expect(result).toEqual({ allowed: false, state: 'no-access' });
  if (result.allowed) expectTypeOf(result.scope).toEqualTypeOf<ScopeRef<Kind> | null>();
  expect(access.resolveBusinessScope({ scope: 'account', capability: null }, '', active, snapshot, kinds))
    .toEqual({ allowed: true, scope: null });
  expect(access.resolveBusinessScope({ scope: 'public', capability: 'missing' }, '', null, snapshot, kinds))
    .toEqual({ allowed: false, state: 'forbidden' });
});
