import type { RecordByResource, ResourceKind, SystemRecord } from './contracts';
import type { FieldOption } from '@niubu/common-ui/form';

export type Translate = (key: string, params?: Record<string, string | number>) => string;
export type Lookups = {
  roles: readonly RecordByResource['roles'][];
  departments: readonly RecordByResource['departments'][];
  menus: readonly RecordByResource['menus'][];
};
export const emptyLookups: Lookups = { roles: [], departments: [], menus: [] };
export const resourceConfig = {
  users: {
    titleKey: 'system.users',
    icon: 'users',
    fields: ['name', 'email', 'roleId', 'departmentId', 'enabled'],
    sortable: ['name', 'email'],
    lookups: ['roles', 'departments'],
  },
  roles: {
    titleKey: 'system.roles',
    icon: 'shield-check',
    fields: ['name', 'code', 'description', 'enabled'],
    sortable: ['name', 'code'],
    lookups: [],
  },
  menus: {
    titleKey: 'system.menus',
    icon: 'menu',
    fields: ['title', 'kind', 'parentId', 'order', 'pageId', 'href', 'openInNewWindow', 'enabled'],
    sortable: ['title', 'order'],
    lookups: ['menus'],
  },
  departments: {
    titleKey: 'system.departments',
    icon: 'building-2',
    fields: ['name', 'code', 'parentId', 'enabled'],
    sortable: ['name', 'code'],
    lookups: ['departments'],
  },
} as const;
export function recordName(record: SystemRecord) {
  return 'title' in record ? record.title : record.name;
}
export function ownerScopeKey(identity: string, scope: { kind: string; id: string } | null) {
  return JSON.stringify([identity, scope?.kind ?? null, scope?.id ?? null]);
}
export function resourceDraftKey(resource: ResourceKind, id?: string) {
  return JSON.stringify(['system', resource, id ?? null]);
}
export function excludedDescendants(
  records: readonly { id: string; parentId: string | null }[],
  id?: string,
): Set<string> {
  const excluded = new Set<string>(id ? [id] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of records)
      if (row.parentId && excluded.has(row.parentId) && !excluded.has(row.id)) {
        excluded.add(row.id);
        changed = true;
      }
  }
  return excluded;
}
export function referenceOptions(
  records: readonly { id: string; enabled: boolean }[],
  name: (row: { id: string }) => string,
  current: string,
  t: Translate,
  excluded = new Set<string>(),
): FieldOption[] {
  const options = records
    .filter(row => !excluded.has(row.id))
    .map(row => ({
      value: row.id,
      label: row.enabled ? name(row) : t('system.disabledReference', { name: name(row) }),
      disabled: !row.enabled,
    }));
  if (current && !options.some(option => option.value === current))
    options.push({ value: current, label: t('system.missingReference', { id: current }), disabled: true });
  return options;
}
export function referenceLabel(
  records: readonly { id: string; enabled: boolean }[],
  id: string | null,
  t: Translate,
): string {
  if (id === null) return t('system.noParent');
  const row = records.find(record => record.id === id);
  if (!row) return t('system.missingReference', { id });
  const name = 'title' in row ? String(row.title) : 'name' in row ? String(row.name) : id;
  return row.enabled ? name : t('system.disabledReference', { name });
}
