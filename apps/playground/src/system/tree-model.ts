import type { QueryCriteria } from './form-schemas';
import type { RecordByResource, ResourceKind, SystemRecord, TreeResource } from './contracts';

export type TreeRecord = RecordByResource[TreeResource];
export function isTreeResource(resource: ResourceKind): resource is TreeResource {
  return resource === 'menus' || resource === 'departments';
}
export function isResourceRecord<K extends ResourceKind>(resource: K, row: SystemRecord): row is RecordByResource[K] {
  if (resource === 'menus') return 'kind' in row;
  if (resource === 'departments') return 'parentId' in row && !('kind' in row);
  if (resource === 'users') return 'email' in row;
  return 'description' in row;
}
export function projectTreeRows<T extends TreeRecord>(source: readonly T[], query: QueryCriteria = {}) {
  const index = new Map(source.map(row => [row.id, row]));
  const keyword = query.keyword?.toLowerCase();
  const matches = source.filter(row => {
    if (query.enabled !== undefined && row.enabled !== query.enabled) return false;
    if (query.kind !== undefined && (!('kind' in row) || row.kind !== query.kind)) return false;
    if (query.parentId !== undefined && row.parentId !== query.parentId) return false;
    const name = 'title' in row ? row.title : row.name;
    return (
      !keyword || name.toLowerCase().includes(keyword) || ('code' in row && row.code.toLowerCase().includes(keyword))
    );
  });
  const included = new Set(matches.map(row => row.id));
  const ancestorIds = new Set<string>();
  for (const row of matches) {
    let parentId = row.parentId;
    const visited = new Set<string>();
    while (parentId !== null) {
      if (visited.has(parentId)) throw new Error('Invalid tree parent cycle');
      visited.add(parentId);
      const parent = index.get(parentId);
      if (!parent) throw new Error('Invalid tree parent');
      included.add(parent.id);
      ancestorIds.add(parent.id);
      parentId = parent.parentId;
    }
  }
  const rows = source.filter(row => included.has(row.id));
  const children = new Map<string, T[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    const siblings = children.get(row.parentId) ?? [];
    siblings.push(row);
    children.set(row.parentId, siblings);
  }
  // Array sorting is stable; equal menu orders retain their snapshot order and DTO identity.
  const compare = (left: T, right: T) => ('order' in left && 'order' in right ? left.order - right.order : 0);
  const roots = rows.filter(row => row.parentId === null).sort(compare);
  for (const siblings of children.values()) siblings.sort(compare);
  return { rows, roots, children, ancestorIds, matches };
}
export function ancestorPath(rows: readonly TreeRecord[], id: string) {
  const index = new Map(rows.map(row => [row.id, row]));
  const path = new Set<string>();
  let row = index.get(id);
  while (row?.parentId) {
    if (path.has(row.parentId)) break;
    path.add(row.parentId);
    row = index.get(row.parentId);
  }
  return path;
}
