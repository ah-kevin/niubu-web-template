import { z } from 'zod';
import { registry } from '../modules/demo';
import type {
  InputByResource,
  RecordByResource,
  ResourceKind,
  SystemPage,
  QueryByResource,
  TreeResource,
  SystemTreeSnapshot,
} from './contracts';
export const systemId = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/);
const name = z.string().trim().min(1).max(80),
  code = z.string().regex(/^[a-z][a-z0-9:_-]{1,63}$/);
export const userInputSchema = z
  .object({ name, email: z.string().email(), roleId: systemId, departmentId: systemId, enabled: z.boolean() })
  .strict();
export const roleInputSchema = z
  .object({ name, code, description: z.string().max(500), enabled: z.boolean() })
  .strict();
export const departmentInputSchema = z
  .object({ name, code, parentId: systemId.nullable(), enabled: z.boolean() })
  .strict();
const menuBase = {
  title: name,
  parentId: systemId.nullable(),
  order: z.number().int().min(0).max(9999),
  enabled: z.boolean(),
  openInNewWindow: z.boolean().optional(),
};
export function safeMenuHref(value: string) {
  if (
    !value ||
    value.trim() !== value ||
    value.includes('\\') ||
    value.startsWith('//') ||
    [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    return false;
  try {
    const url = new URL(value, 'https://starter.invalid');
    return (
      ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      (!/^[a-z][a-z\d+.-]*:/i.test(value) || /^https?:\/\//i.test(value))
    );
  } catch {
    return false;
  }
}
const menuGroup = z.object({ ...menuBase, kind: z.literal('group') }).strict();
const menuPage = z
  .object({
    ...menuBase,
    kind: z.literal('page'),
    pageId: z
      .string()
      .refine(id => registry.routes.some(route => route.navigation && route.id === id), 'Unknown registered page'),
  })
  .strict();
const menuExternal = z
  .object({ ...menuBase, kind: z.literal('external'), href: z.string().refine(safeMenuHref, 'Invalid external URL') })
  .strict();
export const menuInputSchema = z.discriminatedUnion('kind', [menuGroup, menuPage, menuExternal]);
const inputs = {
  users: userInputSchema,
  roles: roleInputSchema,
  menus: menuInputSchema,
  departments: departmentInputSchema,
};
const records = {
  users: userInputSchema.extend({ id: systemId }),
  roles: roleInputSchema.extend({ id: systemId }),
  departments: departmentInputSchema.extend({ id: systemId }),
  menus: z.discriminatedUnion('kind', [
    menuGroup.extend({ id: systemId }),
    menuPage.extend({ id: systemId }),
    menuExternal.extend({ id: systemId }),
  ]),
};
const commonQuery = {
  pageIndex: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  pageSize: z.number().int().min(1).max(100),
  keyword: z.string().max(100).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
};
const queries = {
  users: z
    .object({
      ...commonQuery,
      sortBy: z.enum(['id', 'name', 'email']).optional(),
      roleId: systemId.optional(),
      departmentId: systemId.optional(),
    })
    .strict(),
  roles: z.object({ ...commonQuery, sortBy: z.enum(['id', 'name', 'code']).optional() }).strict(),
  menus: z
    .object({
      ...commonQuery,
      sortBy: z.enum(['id', 'title', 'order']).optional(),
      kind: z.enum(['group', 'page', 'external']).optional(),
    })
    .strict(),
  departments: z
    .object({
      ...commonQuery,
      sortBy: z.enum(['id', 'name', 'code']).optional(),
      parentId: systemId.nullable().optional(),
    })
    .strict(),
};
export function parseSystemInput<K extends ResourceKind>(kind: K, value: unknown): InputByResource[K] {
  return inputs[kind].parse(value) as InputByResource[K];
}
export function parseSystemRecord<K extends ResourceKind>(kind: K, value: unknown): RecordByResource[K] {
  return records[kind].parse(value) as RecordByResource[K];
}
export function parseSystemQuery<K extends ResourceKind>(kind: K, value: unknown): QueryByResource[K] {
  return queries[kind].parse(value) as QueryByResource[K];
}
export function parseSystemPage<K extends ResourceKind>(kind: K, value: unknown): SystemPage<RecordByResource[K]> {
  const page = z
    .object({ rows: z.array(z.unknown()), rowCount: z.number().int().nonnegative() })
    .strict()
    .parse(value);
  const rows = page.rows.map(row => parseSystemRecord(kind, row));
  if (page.rowCount < rows.length || new Set(rows.map(row => row.id)).size !== rows.length)
    throw new Error('Inconsistent system page');
  return { rows, rowCount: page.rowCount };
}

export function parseSystemTree<K extends TreeResource>(
  kind: K,
  value: unknown,
): SystemTreeSnapshot<RecordByResource[K]> {
  try {
    const data = z
      .object({
        rows: z.array(z.unknown()),
        rowCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        complete: z.literal(true),
      })
      .strict()
      .parse(value);
    const rows = data.rows.map(row => parseSystemRecord(kind, row));
    if (data.rowCount !== rows.length) throw new Error('count mismatch');
    // Tree expansion/row dictionaries reserve prototype names; keep legacy record IDs unchanged.
    const unsafeTreeIds = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
    if (rows.some(row => unsafeTreeIds.has(row.id))) throw new Error('unsafe tree id');
    const index = new Map(rows.map(row => [row.id, row]));
    if (index.size !== rows.length) throw new Error('duplicate ids');
    for (const row of rows) {
      if (row.parentId === null) continue;
      const parent = index.get(row.parentId);
      if (!parent) throw new Error('missing parent');
      if ('kind' in parent && parent.kind !== 'group') throw new Error('non-group parent');
    }
    const visited = new Set<string>();
    for (const row of rows) {
      const path = new Set<string>();
      let current: RecordByResource[K] | undefined = row;
      while (current && !visited.has(current.id)) {
        if (path.has(current.id)) throw new Error('parent cycle');
        path.add(current.id);
        current = current.parentId === null ? undefined : index.get(current.parentId);
      }
      for (const id of path) visited.add(id);
    }
    return { rows, rowCount: rows.length, complete: true };
  } catch {
    throw new Error('Invalid complete system tree snapshot');
  }
}
