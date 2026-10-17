import type { AuthUser, BackendMenuItem, ScopeRef } from '@niubu/types';
import type { ResourceRecords, SystemResource, WorkspaceId } from './system/contracts';

export interface MockUser extends AuthUser<'workspace'> {
  workspaces: readonly (ScopeRef<'workspace'> & { readonly name: string })[];
}
export interface MockGrants {
  readonly menu: readonly BackendMenuItem[];
  readonly codes: readonly string[];
}
export interface MockAccount {
  readonly username: string;
  readonly password: string;
  readonly user: MockUser;
  readonly scopes: Readonly<Partial<Record<WorkspaceId, MockGrants>>>;
}
export type MockSystemSeed = { readonly [R in SystemResource]: readonly ResourceRecords[R][] };
export interface MockEndpointContext {
  readonly method: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly query: URLSearchParams;
  /** Copies of the verified profile, never caller-supplied identity or credentials. */
  readonly user?: MockUser;
  readonly scope?: ScopeRef<'workspace'>;
}
export interface MockEndpoint {
  readonly path: string;
  readonly methods: readonly ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[];
  readonly access: 'public' | 'authenticated' | 'workspace';
  /** Only valid with workspace access. All codes are required. */
  readonly requiredCodes?: readonly string[];
  /** Return data; the dispatcher owns the JSON envelope, headers and errors. */
  readonly handler: (context: MockEndpointContext) => unknown | Promise<unknown>;
}
export interface MockConfig {
  readonly accounts: readonly MockAccount[];
  readonly publicMenu: readonly BackendMenuItem[];
  readonly navigablePageIds: readonly string[];
  /** CRUD and transfers currently support the fixed north/south workspace IDs. */
  readonly systemSeeds: Readonly<Record<WorkspaceId, MockSystemSeed>>;
  readonly endpoints?: readonly MockEndpoint[];
}

function invalid(field: string): never {
  // Field names only: a malformed config must never echo synthetic credentials.
  throw new Error(`Invalid mock config: ${field}`);
}
function record(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field);
}
function text(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) invalid(field);
}
function array(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value)) invalid(field);
}
function strings(value: unknown, field: string) {
  array(value, field);
  const seen = new Set<string>();
  for (const item of value) {
    text(item, field);
    if (seen.has(item)) invalid(`${field} duplicate`);
    seen.add(item);
  }
}
function menus(value: unknown, field: string) {
  const ids = new Set<string>();
  const visited = new WeakSet<object>();
  function visit(items: unknown) {
    array(items, field);
    for (const item of items) {
      record(item, field);
      text(item.id, field);
      if (ids.has(item.id) || visited.has(item)) invalid(`${field} duplicate`);
      ids.add(item.id);
      visited.add(item);
      for (const key of ['icon', 'title'] as const) if (item[key] !== undefined) text(item[key], field);
      for (const key of ['hidden', 'openInNewWindow'])
        if (item[key] !== undefined && typeof item[key] !== 'boolean') invalid(field);
      if (item.order !== undefined && (typeof item.order !== 'number' || !Number.isFinite(item.order))) invalid(field);
      if (item.badge !== undefined && typeof item.badge !== 'string' && typeof item.badge !== 'number') invalid(field);
      switch (item.kind) {
        case 'page':
          text(item.pageId, field);
          break;
        case 'group':
          text(item.title, field);
          visit(item.children);
          break;
        case 'external':
          text(item.title, field);
          text(item.href, field);
          break;
        case 'iframe':
          text(item.title, field);
          text(item.src, field);
          break;
        default:
          invalid(field);
      }
    }
  }
  visit(value);
}
const reserved = [
  '/api/auth',
  '/api/system',
  '/api/transfers',
  '/api/health',
  '/api/demo/echo',
  '/api/user',
  '/api/menu',
];

/** Snapshot mutable fixture data once per backend. Handlers remain explicit code references. */
export function snapshotMockConfig(input: MockConfig): MockConfig {
  record(input, 'root');
  let config: MockConfig;
  try {
    const { endpoints, ...data } = input;
    config = {
      ...structuredClone(data),
      ...(endpoints === undefined
        ? {}
        : {
            endpoints: endpoints.map(endpoint => ({
              ...endpoint,
              methods: [...endpoint.methods],
              ...(endpoint.requiredCodes === undefined ? {} : { requiredCodes: [...endpoint.requiredCodes] }),
            })),
          }),
    };
  } catch {
    return invalid('non-cloneable data or endpoint shape');
  }
  strings(config.navigablePageIds, 'navigablePageIds');
  menus(config.publicMenu, 'publicMenu');
  array(config.accounts, 'accounts');
  const usernames = new Set<string>();
  const identities = new Set<string>();
  for (const account of config.accounts) {
    record(account, 'accounts');
    text(account.username, 'accounts.username');
    text(account.password, 'accounts.password');
    record(account.user, 'accounts.user');
    text(account.user.id, 'accounts.user.id');
    text(account.user.name, 'accounts.user.name');
    strings(account.user.roles, 'accounts.user.roles');
    if (usernames.has(account.username) || identities.has(account.user.id)) invalid('duplicate account');
    usernames.add(account.username);
    identities.add(account.user.id);
    array(account.user.workspaces, 'accounts.user.workspaces');
    record(account.scopes, 'accounts.scopes');
    const memberships = new Set<string>();
    for (const workspace of account.user.workspaces) {
      record(workspace, 'accounts.user.workspaces');
      if (
        workspace.kind !== 'workspace' ||
        (workspace.id !== 'north' && workspace.id !== 'south') ||
        memberships.has(workspace.id)
      )
        invalid('accounts.user.workspaces');
      text(workspace.name, 'accounts.user.workspaces.name');
      memberships.add(workspace.id);
      const grants = account.scopes[workspace.id];
      record(grants, 'accounts.scopes grants');
      strings(grants.codes, 'accounts.scopes.codes');
      menus(grants.menu, 'accounts.scopes.menu');
    }
    if (Object.keys(account.scopes).some(id => !memberships.has(id))) invalid('accounts.scopes membership');
  }
  record(config.systemSeeds, 'systemSeeds');
  if (Object.keys(config.systemSeeds).some(id => id !== 'north' && id !== 'south')) invalid('systemSeeds workspace');
  for (const workspace of ['north', 'south'] as const) record(config.systemSeeds[workspace], 'systemSeeds workspace');
  const paths = new Set<string>();
  for (const endpoint of config.endpoints ?? []) {
    record(endpoint, 'endpoints');
    if (
      typeof endpoint.path !== 'string' ||
      !/^\/api\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(endpoint.path) ||
      reserved.some(path => endpoint.path === path || endpoint.path.startsWith(`${path}/`)) ||
      paths.has(endpoint.path)
    )
      invalid('endpoints.path reserved, invalid or duplicate');
    paths.add(endpoint.path);
    strings(endpoint.methods, 'endpoints.methods');
    if (
      !endpoint.methods.length ||
      endpoint.methods.some(method => !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
    )
      invalid('endpoints.methods');
    if (!['public', 'authenticated', 'workspace'].includes(endpoint.access)) invalid('endpoints.access');
    if (endpoint.requiredCodes !== undefined) {
      if (endpoint.access !== 'workspace') invalid('endpoints.requiredCodes requires workspace access');
      strings(endpoint.requiredCodes, 'endpoints.requiredCodes');
    }
    if (typeof endpoint.handler !== 'function') invalid('endpoints.handler');
  }
  return config;
}
