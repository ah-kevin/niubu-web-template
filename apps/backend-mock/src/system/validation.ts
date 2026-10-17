import type { ListQuery, MenuKind, ResourceInput, SystemResource, WorkspaceId } from './contracts';

export class SystemError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function invalid(message = 'Invalid system input'): never {
  throw new SystemError(400, 'INVALID_INPUT', message);
}
const inputKeys: Record<SystemResource, readonly string[]> = {
  users: ['name', 'email', 'roleId', 'departmentId', 'enabled'],
  roles: ['name', 'code', 'description', 'enabled'],
  menus: ['title', 'kind', 'parentId', 'order', 'enabled', 'pageId', 'href', 'openInNewWindow'],
  departments: ['name', 'code', 'parentId', 'enabled'],
};
const sortKeys: Record<SystemResource, readonly string[]> = {
  users: ['id', 'name', 'email'],
  roles: ['id', 'name', 'code'],
  menus: ['id', 'title', 'order'],
  departments: ['id', 'name', 'code'],
};
const filterKeys: Record<SystemResource, readonly string[]> = {
  users: ['roleId', 'departmentId'],
  roles: [],
  menus: ['kind'],
  departments: ['parentId'],
};
function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) invalid();
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') invalid();
  return value;
}
function reference(value: unknown): string {
  const result = text(value, 120);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result)) invalid();
  return result;
}
function parent(value: unknown): string | null {
  return value === null ? null : reference(value);
}
function code(value: unknown): string {
  const result = text(value, 64);
  if (!/^[a-z][a-z0-9:_-]{1,63}$/.test(result)) invalid();
  return result;
}
function kind(value: unknown): MenuKind {
  if (value !== 'group' && value !== 'page' && value !== 'external') invalid();
  return value;
}
function safeHref(value: unknown): string {
  const href = text(value, 2048);
  if (
    [...href].some(
      character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127 || character === '\\',
    ) ||
    href.startsWith('//')
  )
    invalid('Unsafe external href');
  try {
    const url = new URL(href, 'https://mock.invalid/');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) invalid('Unsafe external href');
    // Relative addresses must remain on the base origin; explicit http(s) URLs may leave it.
    if (!/^https?:\/\//i.test(href) && url.origin !== 'https://mock.invalid') invalid('Unsafe external href');
  } catch {
    invalid('Unsafe external href');
  }
  return href;
}
function rejectPrototypeKeys(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) invalid('Forbidden object key');
    // DTOs are flat: every declared field is checked as a scalar below.
    // Do not recurse into rejected objects supplied in scalar fields.
  }
}
export function validateInput<R extends SystemResource>(
  resource: R,
  body: Record<string, unknown>,
  navigablePageIds: readonly string[],
): ResourceInput<R> {
  rejectPrototypeKeys(body);
  if (Object.keys(body).some(key => !inputKeys[resource].includes(key))) invalid('Unknown or immutable field');
  const enabled = boolean(body.enabled);
  let result: ResourceInput<SystemResource>;
  switch (resource) {
    case 'users': {
      const email = text(body.email, 254);
      const parts = email.split('@');
      const local = parts[0];
      const labels = parts[1]?.split('.') ?? [];
      if (
        parts.length !== 2 ||
        local.length > 64 ||
        !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) ||
        local.startsWith('.') ||
        local.endsWith('.') ||
        local.includes('..') ||
        labels.length < 2 ||
        labels.some(label => !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))
      )
        invalid('Invalid email');
      result = {
        name: text(body.name, 80),
        email,
        roleId: reference(body.roleId),
        departmentId: reference(body.departmentId),
        enabled,
      };
      break;
    }
    case 'roles':
      result = {
        name: text(body.name, 80),
        code: code(body.code),
        description: text(body.description, 500, true),
        enabled,
      };
      break;
    case 'departments':
      result = { name: text(body.name, 80), code: code(body.code), parentId: parent(body.parentId), enabled };
      break;
    case 'menus': {
      const menuKind = kind(body.kind);
      if (typeof body.order !== 'number' || !Number.isInteger(body.order) || body.order < 0 || body.order > 9999)
        invalid('Invalid menu order');
      if (body.pageId !== undefined && typeof body.pageId !== 'string') invalid();
      if (body.href !== undefined && typeof body.href !== 'string') invalid();
      if (body.openInNewWindow !== undefined) boolean(body.openInNewWindow);
      const common = {
        title: text(body.title, 80),
        kind: menuKind,
        parentId: parent(body.parentId),
        order: body.order,
        enabled,
      };
      if (menuKind === 'page') {
        const pageId = text(body.pageId, 100);
        if (!navigablePageIds.includes(pageId)) invalid('Unregistered page id');
        result = { ...common, pageId };
      } else if (menuKind === 'external') {
        result = {
          ...common,
          href: safeHref(body.href),
          ...(body.openInNewWindow === undefined ? {} : { openInNewWindow: boolean(body.openInNewWindow) }),
        };
      } else result = common;
      break;
    }
    default:
      return invalid();
  }
  return result as ResourceInput<R>;
}
function decimal(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  if (!/^[0-9]+$/.test(value)) invalid('Expected a decimal integer');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) invalid('Integer out of range');
  return parsed;
}
export function validateQuery(
  resource: SystemResource,
  query: URLSearchParams,
  list: boolean,
): { workspace: WorkspaceId; listQuery: ListQuery } {
  const allowed = [
    'scopeKind',
    'scopeId',
    ...(list ? ['pageIndex', 'pageSize', 'sortBy', 'sortOrder', 'keyword', 'enabled', ...filterKeys[resource]] : []),
  ];
  for (const key of query.keys())
    if (!allowed.includes(key) || query.getAll(key).length !== 1) invalid('Unknown or repeated query parameter');
  const workspace = query.get('scopeId');
  if (query.get('scopeKind') !== 'workspace' || (workspace !== 'north' && workspace !== 'south'))
    throw new SystemError(403, 'UNKNOWN_SCOPE', 'Unknown workspace scope');
  const sortBy = query.get('sortBy') ?? 'id';
  const sortOrder = query.get('sortOrder') ?? 'asc';
  if (!sortKeys[resource].includes(sortBy) || !['asc', 'desc'].includes(sortOrder)) invalid('Invalid sorting');
  const result: ListQuery = {
    pageIndex: decimal(query.get('pageIndex'), 0, 0, Number.MAX_SAFE_INTEGER),
    pageSize: decimal(query.get('pageSize'), 10, 1, 100),
    sortBy,
    sortOrder: sortOrder as 'asc' | 'desc',
  };
  if (query.has('keyword')) result.keyword = text(query.get('keyword'), 100, true);
  if (query.has('enabled')) {
    const value = query.get('enabled');
    if (value !== 'true' && value !== 'false') invalid('Invalid enabled filter');
    result.enabled = value === 'true';
  }
  if (query.has('roleId')) result.roleId = reference(query.get('roleId'));
  if (query.has('departmentId')) result.departmentId = reference(query.get('departmentId'));
  if (query.has('kind')) result.kind = kind(query.get('kind'));
  if (query.has('parentId'))
    result.parentId = query.get('parentId') === 'null' ? null : reference(query.get('parentId'));
  return { workspace, listQuery: result };
}
