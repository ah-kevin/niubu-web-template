import { expect, it } from 'vitest';
import type { ReadContext, RouteMeta } from '@niubu/core-typings';
import { createPageIdentityResolver } from './page-identity';

type Meta = RouteMeta<'region'> & { view?: string };
const common = { scope: 'region' as const, capability: 'read', titleKey: 'record', iconToken: 'File', order: 1, navigation: true };
const routes: readonly Meta[] = [
  { ...common, id: 'list', path: '/records', view: 'view=summary' },
  { ...common, id: 'detail', path: '/records/:id', view: 'view=summary' },
  { ...common, id: 'activity', path: '/records/:id', view: 'view=activity' },
];
const context: ReadContext = { scope: { kind: 'region', id: 'r1' }, businessDate: '2026-10-17', timeZone: 'UTC' };
const resolver = () => createPageIdentityResolver<Meta, 'region', { read: boolean }>({
  routes,
  findRoute: path => path === '/records' ? routes[0] : path === '/records/a1' ? routes[1] : null,
  resolveScope: (_meta, search, scope, access) => {
    const params = new URLSearchParams(search);
    if (!access.read || (params.has('scopeKind') && params.get('scopeKind') !== 'region')) return { allowed: false };
    return { allowed: true, scope: scope?.kind === 'region' ? { kind: 'region', id: scope.id } : null };
  },
  resolveUrlView: () => undefined,
  policies: { '/records': ['summary', 'activity'] },
  aliases: { '/records': { recent: 'activity' } },
  needsReport: location => location.pathname === '/records/a1',
  isPageRoute: () => true,
});

it('keeps identity independent of filters while restoring validated scope and primary view', () => {
  const runtime = resolver();
  const describe = (href: string) => runtime.describePageLocation(new URL(href, 'https://example.invalid'), context, { read: true });
  const first = runtime.resolvePageTab(describe('/records'))!;
  const changed = runtime.resolvePageTab(describe('/records?q=items&page=2#section'))!;
  expect(first.key).toBe('["/records","/records","summary",["region","r1"]]');
  expect(changed.key).toBe(first.key);
  expect(changed.href).toBe('/records?q=items&page=2#section');
  expect(changed.restoreHref).toBe('/records?q=items&page=2&scopeKind=region&scopeId=r1&view=summary#section');
});

it('waits for the mounted page report and canonicalizes aliases before choosing a stable page id', () => {
  const runtime = resolver();
  const location = new URL('/records/a1', 'https://example.invalid');
  expect(runtime.resolvePageTab(runtime.describePageLocation(location, context, { read: true }))).toBeNull();
  const descriptor = runtime.describePageLocation(location, context, { read: true }, { effectiveView: 'recent', locationKey: 'location-1', commitToken: 'token-1' });
  const tab = runtime.resolvePageTab(descriptor)!;
  expect(tab.routeId).toBe('activity');
  expect(tab.key).toBe('["/records","/records/a1","activity",["region","r1"]]');
  expect(descriptor.locationKey).toBe('location-1');
  expect(descriptor.commitToken).toBe('token-1');
});

it.each(['/unknown', '//external.invalid', '/records?view=summary&view=activity', '/records?scopeKind=team&scopeId=r1', '/records?view=missing'])('rejects an invalid or unregistered address: %s', href => {
  const runtime = resolver();
  const descriptor = runtime.describePageLocation(new URL(href, 'https://example.invalid'), context, { read: true });
  expect(runtime.resolvePageTab(descriptor)).toBeNull();
});

it('does not create a page when the injected access policy rejects it', () => {
  const runtime = resolver();
  expect(runtime.resolvePageTab(runtime.describePageLocation(new URL('/records', 'https://example.invalid'), context, { read: false }))).toBeNull();
});
