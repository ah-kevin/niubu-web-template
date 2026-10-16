import type { RouteMeta } from './route';

/** Component representation is supplied by the consumer, with no UI runtime dependency. */
export type DomainRouteLoader<C = unknown> = () => Promise<{ Component: C }>;
export type ModuleMenu = Readonly<{ pageId: string; parentId?: string }>;
export type DomainModule<M extends RouteMeta, C = unknown> = Readonly<{
  id: string;
  routes: readonly M[];
  menus: readonly ModuleMenu[];
  permissions: readonly string[];
  namespaces: readonly string[];
  loaders: Readonly<Record<string, DomainRouteLoader<C>>>;
}>;
export type ModuleRegistry<M extends RouteMeta, C = unknown> = Readonly<{
  routes: readonly M[];
  pageIds: readonly string[];
  loaders: Readonly<Record<string, DomainRouteLoader<C>>>;
  menus: readonly ModuleMenu[];
  permissions: readonly string[];
  namespaces: readonly string[];
}>;
