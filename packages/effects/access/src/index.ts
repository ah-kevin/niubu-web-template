import type { ScopeRef, RouteAccess } from '@niubu/core-typings';
export type AccessSnapshot<K extends string = string> = Readonly<{
  scopes: readonly ScopeRef<K>[];
  capabilities: readonly string[];
}>;
export type { RouteMeta, RouteAccess } from '@niubu/core-typings';
export const sameScope = <K extends string>(a: ScopeRef<K> | null, b: ScopeRef<K> | null): boolean =>
  Boolean(a && b && a.kind === b.kind && a.id === b.id);
export function canAccess<K extends string>(
  meta: RouteAccess<K>,
  access: AccessSnapshot<K>,
  scope: ScopeRef<K> | null,
): boolean {
  if (meta.capability && !access.capabilities.includes(meta.capability)) return false;
  if (meta.scope === 'public' || meta.scope === 'account') return true;
  return Boolean(scope?.id && scope.kind === meta.scope && access.scopes.some(allowed => sameScope(allowed, scope)));
}
export const projectRoutes = <K extends string, T extends RouteAccess<K>>(
  registry: readonly T[],
  access: AccessSnapshot<K>,
  scope: ScopeRef<K> | null,
): readonly T[] => registry.filter(meta => canAccess(meta, access, scope));
/** Explicit malformed, duplicate or other-scope URL metadata never uses the active default. */
export function requestedScope<K extends string>(
  search: string,
  active: ScopeRef<K> | null,
  kinds: readonly K[],
): { scope: ScopeRef<K> | null; valid: boolean } {
  const params = new URLSearchParams(search);
  const kind = params.get('scopeKind');
  const id = params.get('scopeId');
  if (kind === null && id === null) return { scope: active, valid: true };
  if (
    kind === null ||
    !kinds.includes(kind as K) ||
    !id ||
    params.getAll('scopeKind').length !== 1 ||
    params.getAll('scopeId').length !== 1
  )
    return { scope: null, valid: false };
  const scope: ScopeRef<K> = { kind: kind as K, id };
  return { scope, valid: sameScope(scope, active) };
}
export { createModuleRegistry } from './module-registry';
export type { DomainModule, DomainRouteLoader, ModuleMenu, ModuleRegistry } from '@niubu/core-typings';
export { navigationHref, flattenNavigation, projectBusinessNavigation, projectBreadcrumbs } from './navigation';
export type { NavigationNode, NavigationRoute, NavigationOptions, BreadcrumbItem } from './navigation';
export { resolveBusinessScope } from './route-scope';
export type { BusinessScopeResult } from './route-scope';
export { resolveAccess } from './backend-menu';
export type {
  ResolveAccessOptions,
  AccessResolution,
  AccessMenuNode,
  AccessPageNode,
  IframeNode,
  AccessDiagnostic,
  AccessLinkTarget,
} from './backend-menu';
export { matchesPermissions } from './permissions';
export type { AccessMatchMode } from './permissions';
