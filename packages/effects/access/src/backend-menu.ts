import type {
  AccessMode,
  BackendMenuItem,
  MenuPresentation,
  ModuleMenu,
  RouteMeta,
  ScopeRef,
} from '@niubu/core-typings';
import { canAccess, sameScope, type AccessSnapshot } from './index';
import { navigationHref } from './navigation';
import { matchesPermissions } from './permissions';

export type AccessLinkTarget = Readonly<{ target?: '_blank'; rel?: 'noopener noreferrer' }>;
export type AccessPageNode = Readonly<
  MenuPresentation &
    AccessLinkTarget & {
      kind: 'page';
      id: string;
      pageId: string;
      title: string;
      href: string;
      fixedTab?: boolean;
      hideInTabs?: boolean;
      hideInBreadcrumbs?: boolean;
      activePath?: string;
    }
>;
export type IframeNode = Readonly<
  MenuPresentation &
    AccessLinkTarget & {
      kind: 'iframe';
      id: string;
      title: string;
      src: string;
    }
>;
export type AccessMenuNode =
  | AccessPageNode
  | IframeNode
  | Readonly<MenuPresentation & AccessLinkTarget & { kind: 'external'; id: string; title: string; href: string }>
  | Readonly<MenuPresentation & { kind: 'group'; id: string; title: string; children: readonly AccessMenuNode[] }>;
export type AccessDiagnostic = Readonly<{ code: string; id: string; pageId?: string; message?: string }>;
export type ResolveAccessOptions = Readonly<{
  mode: AccessMode;
  routes: readonly RouteMeta[];
  frontendMenu?: readonly ModuleMenu[];
  backendMenu?: readonly BackendMenuItem[];
  access: AccessSnapshot;
  roles: readonly string[];
  codes: readonly string[];
  scope: ScopeRef | null;
  authenticated: boolean;
  baseURL: string;
}>;
export type AccessResolution = Readonly<{
  menu: readonly AccessMenuNode[];
  grantedPageIds: readonly string[];
  iframeItems: readonly IframeNode[];
  diagnostics: readonly AccessDiagnostic[];
}>;

const codeAllows = (route: RouteMeta): boolean => route.scope === 'public' || route.ignoreAccess === true;
const target = (newWindow?: boolean): AccessLinkTarget =>
  newWindow ? { target: '_blank', rel: 'noopener noreferrer' } : {};
const ordered = <T extends { order?: number }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Copy only known display fields; never spread a wire item into a page projection. */
function presentation(item: MenuPresentation): MenuPresentation {
  return {
    title: item.title,
    icon: item.icon,
    badge: item.badge,
    order: item.order,
    hidden: item.hidden,
    openInNewWindow: item.openInNewWindow,
  };
}

/** Relative links stay relative, but must resolve to the supplied HTTP(S) origin. */
function safeURL(value: string, baseURL: string): string | null {
  const hasControl = [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (!value || value.trim() !== value || value.includes('\\') || hasControl || value.startsWith('//')) return null;
  try {
    const base = new URL(baseURL);
    if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;
    const absolute = /^[a-z][a-z\d+.-]*:/i.test(value);
    if (absolute && !/^https?:\/\//i.test(value)) return null;
    const url = new URL(value, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!absolute && url.origin !== base.origin) return null;
    return absolute ? url.href : value;
  } catch {
    return null;
  }
}

/** Pure authorization projection. No React, owners, loaders or dynamic route registration. */
export function resolveAccess(options: ResolveAccessOptions): AccessResolution {
  const diagnostics: AccessDiagnostic[] = [];
  const diagnose = (code: string, id: string, pageId?: string): void => {
    diagnostics.push(Object.freeze({ code, id, ...(pageId === undefined ? {} : { pageId }) }));
  };
  const registry = new Map<string, RouteMeta>();
  for (const route of options.routes) {
    if (registry.has(route.id)) diagnose('duplicate-route', route.id, route.id);
    else registry.set(route.id, route);
  }
  const eligible = (route: RouteMeta): boolean =>
    codeAllows(route) ||
    (options.authenticated &&
      canAccess(route, options.access, options.scope) &&
      matchesPermissions(options.roles, route.requiredRoles, 'any') &&
      matchesPermissions(options.codes, route.requiredCodes, 'all'));
  const granted = new Set<string>();
  for (const route of registry.values()) {
    if (codeAllows(route) || (options.mode !== 'backend' && eligible(route))) granted.add(route.id);
  }
  const pageNode = (route: RouteMeta, id: string, display: MenuPresentation = {}): AccessPageNode => {
    const openInNewWindow = display.openInNewWindow ?? route.openInNewWindow;
    return Object.freeze({
      ...presentation(display),
      kind: 'page',
      id,
      pageId: route.id,
      title: display.title ?? route.titleKey,
      icon: display.icon ?? route.iconToken,
      order: display.order ?? route.order,
      badge: display.badge ?? route.badge,
      openInNewWindow,
      href: navigationHref(route, options.scope),
      ...target(openInNewWindow),
      fixedTab: route.fixedTab,
      hideInTabs: route.hideInTabs,
      hideInBreadcrumbs: route.hideInBreadcrumbs,
      activePath: route.activePath,
    });
  };
  const backendIds = new Set<string>();
  const backendPages = new Set<string>();
  const validScope = options.scope === null || options.access.scopes.some(scope => sameScope(scope, options.scope));
  const projectBackend = (items: readonly BackendMenuItem[], ancestorHidden = false): readonly AccessMenuNode[] => {
    const nodes: AccessMenuNode[] = [];
    // Reserve duplicates in declaration order, independently of presentation order.
    for (const item of items) {
      const itemId = item.id;
      if (!item.id || item.id.trim() !== item.id) {
        diagnose('invalid-id', item.id);
        continue;
      }
      if (backendIds.has(item.id)) {
        diagnose('duplicate-id', item.id);
        continue;
      }
      backendIds.add(item.id);
      const hidden = ancestorHidden || item.hidden === true;
      if (item.kind === 'group') {
        const children = projectBackend(item.children, hidden);
        if (!hidden && children.length)
          nodes.push(
            Object.freeze({
              ...presentation(item),
              kind: 'group',
              id: item.id,
              title: item.title,
              children,
            }),
          );
      } else if (item.kind === 'page') {
        const route = registry.get(item.pageId);
        if (!route) {
          diagnose('unknown-page', item.id, item.pageId);
          continue;
        }
        if (backendPages.has(item.pageId)) {
          diagnose('duplicate-page', item.id, item.pageId);
          continue;
        }
        backendPages.add(item.pageId);
        if (!eligible(route)) continue;
        granted.add(route.id);
        if (!hidden && !route.hideInMenu) nodes.push(pageNode(route, item.id, item));
      } else if (item.kind === 'external' || item.kind === 'iframe') {
        const url = safeURL(item.kind === 'external' ? item.href : item.src, options.baseURL);
        if (url === null) {
          diagnose('unsafe-url', item.id);
          continue;
        }
        if (hidden || !options.authenticated || !validScope) continue;
        const display = { ...presentation(item), id: item.id, title: item.title, ...target(item.openInNewWindow) };
        nodes.push(
          Object.freeze(
            item.kind === 'external'
              ? { ...display, kind: 'external', href: url }
              : { ...display, kind: 'iframe', src: url },
          ),
        );
      } else {
        diagnose('invalid-kind', itemId);
      }
    }
    return Object.freeze(ordered(nodes));
  };
  const backend = options.mode === 'frontend' ? [] : projectBackend(options.backendMenu ?? []);

  const projectFrontend = (): readonly AccessMenuNode[] => {
    const entries =
      options.frontendMenu ??
      [...registry.values()].filter(route => route.navigation).map(route => ({ pageId: route.id }));
    const declarations = new Map<string, ModuleMenu>();
    for (const entry of entries) {
      if (!registry.has(entry.pageId)) {
        diagnose('unknown-page', entry.pageId, entry.pageId);
        continue;
      }
      if (declarations.has(entry.pageId)) {
        diagnose('duplicate-page', entry.pageId, entry.pageId);
        continue;
      }
      declarations.set(entry.pageId, entry);
    }
    const visible = new Map<string, AccessPageNode>();
    for (const entry of declarations.values()) {
      const route = registry.get(entry.pageId)!;
      if (!granted.has(route.id) || route.hideInMenu || backendPages.has(route.id)) continue;
      if (backendIds.has(route.id)) {
        diagnose('duplicate-id', route.id, route.id);
        continue;
      }
      visible.set(route.id, pageNode(route, route.id));
    }
    // A navigable parent remains a page inside a generated group, preserving its URL.
    const children = new Map<string, string[]>();
    const roots: string[] = [];
    for (const id of visible.keys()) {
      const parent = declarations.get(id)?.parentId;
      if (parent && !registry.has(parent)) {
        diagnose('unknown-parent', id, parent);
        continue;
      }
      const seen = new Set([id]);
      let ancestor = parent;
      let cycle = false;
      while (ancestor) {
        if (seen.has(ancestor)) {
          cycle = true;
          break;
        }
        seen.add(ancestor);
        ancestor = declarations.get(ancestor)?.parentId;
      }
      if (cycle) {
        diagnose('cyclic-parent', id, id);
        continue;
      }
      if (parent && visible.has(parent)) children.set(parent, [...(children.get(parent) ?? []), id]);
      else roots.push(id);
    }
    const build = (id: string): readonly AccessMenuNode[] => {
      const node = visible.get(id)!;
      const nested = children.get(id);
      if (!nested?.length) return [node];
      const contents = ordered([node, ...nested.flatMap(build)]);
      const groupId = `group:${id}`;
      if (backendIds.has(groupId) || visible.has(groupId)) {
        diagnose('duplicate-id', groupId, id);
        return contents;
      }
      return [
        Object.freeze({
          kind: 'group',
          id: groupId,
          title: node.title,
          icon: node.icon,
          order: node.order,
          children: Object.freeze(contents),
        }),
      ];
    };
    return ordered(roots.flatMap(build));
  };
  const frontend = options.mode === 'backend' ? [] : projectFrontend();
  // Backend tree wins same-page presentation; frontend-only items remain in static order.
  const menu = Object.freeze(ordered([...backend, ...frontend]));
  const iframeItems: IframeNode[] = [];
  const collectFrames = (nodes: readonly AccessMenuNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'group') collectFrames(node.children);
      else if (node.kind === 'iframe') iframeItems.push(node);
    }
  };
  collectFrames(menu);
  return Object.freeze({
    menu,
    iframeItems: Object.freeze(iframeItems),
    diagnostics: Object.freeze(diagnostics),
    grantedPageIds: Object.freeze([...registry.keys()].filter(id => granted.has(id))),
  });
}
