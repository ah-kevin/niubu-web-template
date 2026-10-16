import type { PageTab } from './tabs';
import { sameAppHref } from '@niubu/core-shared';
export type TabSessionIdentity = Readonly<{ product: string; appId: string; environment: string; identityKey: string }>;
const tuple = (i: TabSessionIdentity) => [i.product, i.appId, i.environment, i.identityKey];
export function tabSessionKey(i: TabSessionIdentity, storageNamespace: string): string {
  if (typeof storageNamespace !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(storageNamespace))
    throw Error('Explicit app storage namespace required');
  return `${storageNamespace}.tabs:` + encodeURIComponent(JSON.stringify(tuple(i)));
}
const own = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
export function serializeTabSession(tabs: readonly PageTab[], identity: TabSessionIdentity): string {
  return JSON.stringify({
    schemaVersion: 1,
    identity: {
      product: identity.product,
      appId: identity.appId,
      environment: identity.environment,
      identityKey: identity.identityKey,
    },
    tabs: tabs.map(t => ({ key: t.key, routeId: t.routeId, restoreHref: t.restoreHref, pinned: t.pinned })),
  });
}
/** Revalidate each href independently. Cached identities are consistency checks, never authority. */
export function parseTabSession(
  raw: string | null,
  validate: (restoreHref: string) => PageTab | null,
  identity?: TabSessionIdentity,
): readonly PageTab[] {
  if (raw === null || raw.length > 1_000_000) return [];
  try {
    const envelope: unknown = JSON.parse(raw);
    if (
      !own(envelope) ||
      envelope.schemaVersion !== 1 ||
      !own(envelope.identity) ||
      !Array.isArray(envelope.tabs) ||
      envelope.tabs.length > 1000 ||
      Object.keys(envelope).some(k => !['schemaVersion', 'identity', 'tabs'].includes(k))
    )
      return [];
    const owner = envelope.identity;
    if (
      Object.keys(owner).length !== 4 ||
      ['product', 'appId', 'environment', 'identityKey'].some(k => typeof owner[k] !== 'string' || !owner[k])
    )
      return [];
    if (identity && JSON.stringify(tuple(owner as TabSessionIdentity)) !== JSON.stringify(tuple(identity))) return [];
    const tabs = new Map<string, PageTab>();
    for (const item of envelope.tabs) {
      if (
        !own(item) ||
        Object.keys(item).some(k => !['key', 'routeId', 'restoreHref', 'pinned'].includes(k)) ||
        typeof item.restoreHref !== 'string' ||
        !sameAppHref(item.restoreHref) ||
        typeof item.pinned !== 'boolean'
      )
        continue;
      const tab = validate(item.restoreHref);
      if (!tab || tab.key !== item.key || tab.routeId !== item.routeId) continue;
      const previous = tabs.get(tab.key);
      tabs.set(tab.key, Object.freeze({ ...tab, pinned: item.pinned || !!previous?.pinned, refreshNonce: 0 }));
    }
    return Object.freeze([...tabs.values()]);
  } catch {
    return [];
  }
}
