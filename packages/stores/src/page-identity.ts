import { sameAppHref } from '@niubu/core-shared';
import type { ReadContext, RouteMeta, ScopeRef } from '@niubu/core-typings';
import type { PageTab } from './tabs';

export type PageLocation = Readonly<{ pathname: string; search: string; hash: string }>;
export type PageRouteMeta = RouteMeta & Readonly<{ view?: string }>;
export type PageTypeReport = Readonly<{
  effectiveView?: string;
  status?: 'ready' | 'unresolved' | 'rejected';
  locationKey?: string;
  commitToken?: string;
}>;
export type ResolvedPageDescriptor<M extends PageRouteMeta = PageRouteMeta, K extends string = string> = Readonly<{
  status: 'ready' | 'unresolved' | 'rejected';
  locationKey: string;
  commitToken: string;
  family: string;
  entityPath: string;
  entityId: string | null;
  effectiveView: string | null;
  scope: ScopeRef<K> | null;
  meta: M | null;
  href: string;
  restoreHref: string;
}>;
export type PageIdentityOptions<M extends PageRouteMeta, K extends string, A> = Readonly<{
  routes: readonly M[];
  findRoute(path: string, search: string): M | null;
  resolveScope(
    meta: M,
    search: string,
    active: ScopeRef | null,
    access: A,
  ): Readonly<{ allowed: true; scope: ScopeRef<K> | null }> | Readonly<{ allowed: false }>;
  resolveUrlView(family: string, query: URLSearchParams): string | null | undefined;
  policies: Readonly<Record<string, readonly string[]>>;
  aliases: Readonly<Record<string, Readonly<Record<string, string>>>>;
  needsReport(location: PageLocation): boolean;
  isPageRoute(meta: M): boolean;
}>;

/** Identity is derived from static metadata and caller-owned selectors, never from cached authority. */
export function createPageIdentityResolver<M extends PageRouteMeta, K extends string, A>(
  options: PageIdentityOptions<M, K, A>,
) {
  function describePageLocation(
    location: PageLocation,
    context: ReadContext | null,
    access: A,
    report: PageTypeReport = {},
  ): ResolvedPageDescriptor<M, K> {
    const href = location.pathname + location.search + location.hash;
    const meta = sameAppHref(href) ? options.findRoute(location.pathname, location.search) : null;
    const query = new URLSearchParams(location.search);
    const family = meta?.path.replace(/\/(?:new|:id)(?:\/edit)?$/, '') ?? '';
    const empty: ResolvedPageDescriptor<M, K> = {
      status: 'rejected',
      locationKey: report.locationKey ?? '',
      commitToken: report.commitToken ?? '',
      family,
      entityPath: location.pathname,
      entityId: null,
      effectiveView: null,
      scope: null,
      meta,
      href,
      restoreHref: href,
    };
    if (
      !meta ||
      !options.isPageRoute(meta) ||
      ['view', 'scopeKind', 'scopeId'].some(key => query.getAll(key).length > 1)
    )
      return empty;
    const result = options.resolveScope(meta, location.search, context?.scope ?? null, access);
    if (!result.allowed) return empty;
    const idIndex = meta.path.split('/').indexOf(':id');
    const entityId = idIndex < 0 ? null : location.pathname.split('/')[idIndex];
    const allowed = options.policies[family];
    const raw = query.get('view');
    const urlView = options.resolveUrlView(family, query);
    if (urlView === null) return empty;
    const canonical = (value: string) => options.aliases[family]?.[value] ?? value;
    let effectiveView: string | null = null;
    if (allowed) {
      effectiveView = canonical(report.effectiveView ?? raw ?? urlView ?? allowed[0]);
      if (!allowed.includes(effectiveView) || (raw !== null && !allowed.includes(canonical(raw)))) return empty;
      if (report.effectiveView && raw !== null && canonical(raw) !== effectiveView) return empty;
    }
    const status =
      report.status ?? (options.needsReport(location) && !report.effectiveView && !raw ? 'unresolved' : 'ready');
    const restore = new URLSearchParams(query);
    if (result.scope && !query.has('scopeKind') && !query.has('scopeId')) {
      restore.set('scopeKind', result.scope.kind);
      restore.set('scopeId', result.scope.id);
    }
    if (effectiveView && !query.has('view')) restore.set('view', effectiveView);
    return {
      ...empty,
      status,
      entityId,
      effectiveView,
      scope: result.scope,
      restoreHref: location.pathname + (restore.size ? '?' + restore : '') + location.hash,
    };
  }
  function resolvePageTab(descriptor: ResolvedPageDescriptor): PageTab | null {
    if (
      descriptor.status !== 'ready' ||
      !descriptor.meta ||
      !sameAppHref(descriptor.href) ||
      !sameAppHref(descriptor.restoreHref)
    )
      return null;
    const { family, entityPath, effectiveView, scope, meta } = descriptor;
    const canonicalMeta =
      options.routes.find(
        route => route.path === meta.path && (!effectiveView || route.view === `view=${effectiveView}`),
      ) ?? options.routes.find(route => route.path === meta.path);
    if (!canonicalMeta) return null;
    return Object.freeze({
      key: JSON.stringify([family, entityPath, effectiveView, scope ? [scope.kind, scope.id] : null]),
      routeId: canonicalMeta.id,
      href: descriptor.href,
      restoreHref: descriptor.restoreHref,
      scopeKey: scope ? JSON.stringify([scope.kind, scope.id]) : null,
      pinned: false,
      refreshNonce: 0,
    });
  }
  return Object.freeze({ describePageLocation, resolvePageTab, needsPageTypeReport: options.needsReport });
}
