import { systemResources } from './contracts';
import type {
  HierarchyResource,
  ListQuery,
  QueryPage,
  ResourceInput,
  ResourceRecords,
  SystemResource,
  TreeSnapshot,
  WorkspaceId,
} from './contracts';
import { createWorkspaceSeed, navigablePageIds as defaultPageIds } from './fixtures';
import type { MockSystemSeed } from '../config';
import { SystemError, validateInput } from './validation';

type WorkspaceMaps = { [R in SystemResource]: Map<string, ResourceRecords[R]> };
const prefixes: Record<SystemResource, string> = {
  users: 'user',
  roles: 'role',
  menus: 'menu',
  departments: 'department',
};
function workspaceMaps(input: MockSystemSeed): WorkspaceMaps {
  const seed = structuredClone(input);
  for (const resource of systemResources) {
    const rows = seed[resource];
    if (
      !Array.isArray(rows) ||
      rows.some(row => !row || typeof row.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(row.id)) ||
      new Set(rows.map(row => row.id)).size !== rows.length
    )
      throw new Error('Invalid mock config: systemSeeds records');
  }
  return {
    users: new Map(seed.users.map(row => [row.id, row])),
    roles: new Map(seed.roles.map(row => [row.id, row])),
    menus: new Map(seed.menus.map(row => [row.id, row])),
    departments: new Map(seed.departments.map(row => [row.id, row])),
  };
}
function conflict(message: string): never {
  throw new SystemError(409, 'CONFLICT', message);
}
function notFound(): never {
  throw new SystemError(404, 'NOT_FOUND', 'System record not found');
}
function compare(a: string | number, b: string | number) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function createSystemRepository(
  options: { seeds?: Readonly<Record<WorkspaceId, MockSystemSeed>>; navigablePageIds?: readonly string[] } = {},
) {
  const pageIds = [...(options.navigablePageIds ?? defaultPageIds)];
  const seeds = options.seeds ?? { north: createWorkspaceSeed('north'), south: createWorkspaceSeed('south') };
  const workspaces = new Map<WorkspaceId, WorkspaceMaps>([
    ['north', workspaceMaps(seeds.north)],
    ['south', workspaceMaps(seeds.south)],
  ]);
  function maps(workspace: WorkspaceId): WorkspaceMaps {
    const data = workspaces.get(workspace);
    if (!data) throw new SystemError(503, 'DISPOSED', 'System repository is closed');
    return data;
  }
  function getMap<R extends SystemResource>(workspace: WorkspaceId, resource: R): Map<string, ResourceRecords[R]> {
    return maps(workspace)[resource];
  }
  function current<R extends SystemResource>(workspace: WorkspaceId, resource: R, id: string): ResourceRecords[R] {
    return getMap(workspace, resource).get(id) ?? notFound();
  }
  function validateRelations(
    workspace: WorkspaceId,
    resource: SystemResource,
    id: string,
    input: ResourceInput<SystemResource>,
  ) {
    const data = maps(workspace);
    if (resource === 'users' && 'email' in input) {
      if (!data.roles.has(input.roleId) || !data.departments.has(input.departmentId))
        conflict('Missing workspace role or department');
      if ([...data.users.values()].some(row => row.id !== id && row.email.toLowerCase() === input.email.toLowerCase()))
        conflict('Email already exists');
    }
    if ((resource === 'roles' || resource === 'departments') && 'code' in input) {
      if ([...data[resource].values()].some(row => row.id !== id && row.code === input.code))
        conflict('Code already exists');
    }
    if ((resource === 'menus' || resource === 'departments') && 'parentId' in input) {
      const parents = data[resource];
      let ancestor = input.parentId;
      const seen = new Set([id]);
      while (ancestor !== null) {
        if (seen.has(ancestor)) conflict('Parent cycle');
        seen.add(ancestor);
        const record = parents.get(ancestor);
        if (!record) conflict('Missing workspace parent');
        if ('kind' in record && record.kind !== 'group') conflict('Menu parent must be a group');
        ancestor = record.parentId;
      }
      if (
        resource === 'menus' &&
        'kind' in input &&
        input.kind !== 'group' &&
        [...data.menus.values()].some(row => row.parentId === id)
      )
        conflict('A parent menu must remain a group');
    }
  }
  try {
    for (const [workspace, data] of workspaces) {
      for (const resource of systemResources) {
        for (const row of data[resource].values()) {
          const { id, ...body } = row;
          const input = validateInput(resource, body, pageIds);
          validateRelations(workspace, resource, id, input);
          // Seed rows use the same variant-specific DTO projection as create/update.
          getMap(workspace, resource).set(id, { ...input, id });
        }
      }
    }
  } catch {
    throw new Error('Invalid mock config: systemSeeds input or relations');
  }
  return {
    tree<R extends HierarchyResource>(workspace: WorkspaceId, resource: R): TreeSnapshot<ResourceRecords[R]> {
      const rows = [...getMap(workspace, resource).values()];
      return structuredClone({ rows, rowCount: rows.length, complete: true });
    },
    list<R extends SystemResource>(
      workspace: WorkspaceId,
      resource: R,
      query: ListQuery,
    ): QueryPage<ResourceRecords[R]> {
      let rows = [...getMap(workspace, resource).values()];
      const keyword = query.keyword?.toLowerCase();
      rows = rows.filter(row => {
        if (query.enabled !== undefined && row.enabled !== query.enabled) return false;
        const record = row as unknown as Record<string, unknown>;
        if (
          keyword &&
          !['name', 'title', 'email', 'code'].some(
            key => typeof record[key] === 'string' && record[key].toLowerCase().includes(keyword),
          )
        )
          return false;
        for (const key of ['roleId', 'departmentId', 'kind', 'parentId'] as const)
          if (query[key] !== undefined && record[key] !== query[key]) return false;
        return true;
      });
      rows.sort((a, b) => {
        const left = a as unknown as Record<string, string | number>;
        const right = b as unknown as Record<string, string | number>;
        const order = compare(left[query.sortBy], right[query.sortBy]) * (query.sortOrder === 'desc' ? -1 : 1);
        return order || compare(a.id, b.id);
      });
      const rowCount = rows.length;
      // Compare page counts before multiplication to avoid unsafe large offsets.
      const start =
        query.pageIndex > Math.ceil(rowCount / query.pageSize) ? rowCount : query.pageIndex * query.pageSize;
      return structuredClone({ rows: rows.slice(start, start + query.pageSize), rowCount });
    },
    get<R extends SystemResource>(workspace: WorkspaceId, resource: R, id: string): ResourceRecords[R] {
      return structuredClone(current(workspace, resource, id));
    },
    create<R extends SystemResource>(
      workspace: WorkspaceId,
      resource: R,
      body: Record<string, unknown>,
    ): ResourceRecords[R] {
      const input = validateInput(resource, body, pageIds);
      const records = getMap(workspace, resource);
      let id: string;
      do {
        id = `${prefixes[resource]}-${crypto.randomUUID()}`;
      } while (records.has(id));
      validateRelations(workspace, resource, id, input);
      const row = { ...input, id } as unknown as ResourceRecords[R];
      records.set(id, row);
      return structuredClone(row);
    },
    update<R extends SystemResource>(
      workspace: WorkspaceId,
      resource: R,
      id: string,
      body: Record<string, unknown>,
    ): ResourceRecords[R] {
      current(workspace, resource, id);
      const input = validateInput(resource, body, pageIds);
      validateRelations(workspace, resource, id, input);
      const row = { ...input, id } as unknown as ResourceRecords[R];
      getMap(workspace, resource).set(id, row);
      return structuredClone(row);
    },
    remove(workspace: WorkspaceId, resource: SystemResource, id: string): { id: string } {
      current(workspace, resource, id);
      const data = maps(workspace);
      if (resource === 'roles' && [...data.users.values()].some(user => user.roleId === id))
        conflict('Role is referenced by users');
      if (
        resource === 'departments' &&
        ([...data.users.values()].some(user => user.departmentId === id) ||
          [...data.departments.values()].some(row => row.parentId === id))
      )
        conflict('Department has dependents');
      if (resource === 'menus' && [...data.menus.values()].some(row => row.parentId === id))
        conflict('Menu has children');
      data[resource].delete(id);
      return { id };
    },
    dispose() {
      for (const data of workspaces.values()) for (const resource of systemResources) data[resource].clear();
      workspaces.clear();
    },
  };
}
export type SystemRepository = ReturnType<typeof createSystemRepository>;
