import { expect, it } from 'vitest';
import type { PageTab } from './tabs';
import { parseTabSession, serializeTabSession, tabSessionKey } from './tab-session';

const identity = { product: 'template', appId: 'template-playground', environment: 'local', identityKey: 'fixture-user' };
const tab: PageTab = { key: 'one', routeId: 'record-detail', href: '/records/r1', restoreHref: '/records/r1', scopeKey: 'region:r1', pinned: true, refreshNonce: 3 };

it('uses the supplied app namespace while preserving exact identity encoding', () => {
  expect(tabSessionKey(identity, 'playground')).toBe('playground.tabs:%5B%22template%22%2C%22template-playground%22%2C%22local%22%2C%22fixture-user%22%5D');
  expect(tabSessionKey(identity, 'alpha')).not.toBe(tabSessionKey(identity, 'beta'));
});

it('revalidates cached hrefs and owners without persisting transient refresh state', () => {
  const raw = serializeTabSession([tab], identity);
  const validate = (href: string) => href === '/records/r1' ? tab : null;
  expect(parseTabSession(raw, validate, identity)).toEqual([{ ...tab, refreshNonce: 0 }]);
  expect(parseTabSession(raw, validate, { ...identity, identityKey: 'different' })).toEqual([]);
  const altered = JSON.parse(raw);
  altered.tabs.push({ key: 'secret', routeId: 'record-detail', restoreHref: '//outside.invalid', pinned: false });
  altered.tabs.push({ key: 'wrong', routeId: tab.routeId, restoreHref: tab.restoreHref, pinned: false });
  expect(parseTabSession(JSON.stringify(altered), validate, identity)).toEqual([{ ...tab, refreshNonce: 0 }]);
});
