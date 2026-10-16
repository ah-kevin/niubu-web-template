import type { DomainModule, DomainRouteLoader, ModuleMenu, ModuleRegistry, RouteMeta } from '@niubu/core-typings';

export function createModuleRegistry<M extends RouteMeta, C = unknown>(
  modules: readonly DomainModule<M, C>[],
): ModuleRegistry<M, C> {
  const moduleIds = new Set<string>();
  const pageIds = new Set<string>();
  const identities = new Set<string>();
  const routes: M[] = [];
  const loaders: Record<string, DomainRouteLoader<C>> = Object.create(null);
  const menus: ModuleMenu[] = [];
  const permissions = new Set<string>();
  const namespaces = new Set<string>();
  for (const module of modules) {
    if (moduleIds.has(module.id)) throw new Error(`duplicate module id: ${module.id}`);
    moduleIds.add(module.id);
    for (const route of module.routes) {
      const pair = JSON.stringify([route.path, 'view' in route ? (route.view ?? '') : '']);
      if (pageIds.has(route.id)) throw new Error(`duplicate page id: ${route.id}`);
      if (identities.has(pair)) throw new Error(`duplicate route identity: ${pair}`);
      pageIds.add(route.id);
      identities.add(pair);
      routes.push(route);
    }
    for (const [path, loader] of Object.entries(module.loaders)) {
      if (loaders[path] && loaders[path] !== loader)
        throw new Error(`conflicting loader for path: ${path} in module: ${module.id}`);
      loaders[path] = loader;
    }
    menus.push(...module.menus.map(menu => Object.freeze({ ...menu })));
    module.permissions.forEach(permission => permissions.add(permission));
    module.namespaces.forEach(namespace => namespaces.add(namespace));
  }
  for (const menu of menus) {
    if (!pageIds.has(menu.pageId)) throw new Error(`unknown menu page id: ${menu.pageId}`);
    if (menu.parentId !== undefined && !pageIds.has(menu.parentId))
      throw new Error(`unknown menu parent page id: ${menu.parentId}`);
  }
  routes.sort((a, b) => a.order - b.order);
  return Object.freeze({
    routes: Object.freeze(routes),
    pageIds: Object.freeze(routes.map(route => route.id)),
    loaders: Object.freeze(loaders),
    menus: Object.freeze(menus),
    permissions: Object.freeze([...permissions]),
    namespaces: Object.freeze([...namespaces]),
  });
}
