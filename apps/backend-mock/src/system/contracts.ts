export const systemResources = ['users', 'roles', 'menus', 'departments'] as const;
export type SystemResource = (typeof systemResources)[number];
export type WorkspaceId = 'north' | 'south';
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  roleId: string;
  departmentId: string;
  enabled: boolean;
}
export interface RoleRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  enabled: boolean;
}
export type MenuKind = 'group' | 'page' | 'external';
export interface MenuRecord {
  id: string;
  title: string;
  kind: MenuKind;
  parentId: string | null;
  order: number;
  enabled: boolean;
  pageId?: string;
  href?: string;
  openInNewWindow?: boolean;
}
export interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  enabled: boolean;
}
export interface ResourceRecords {
  users: UserRecord;
  roles: RoleRecord;
  menus: MenuRecord;
  departments: DepartmentRecord;
}
export type ResourceInput<R extends SystemResource> = R extends SystemResource ? Omit<ResourceRecords[R], 'id'> : never;
export type SystemRecord = ResourceRecords[SystemResource];
export interface ListQuery {
  pageIndex: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  keyword?: string;
  enabled?: boolean;
  roleId?: string;
  departmentId?: string;
  kind?: MenuKind;
  parentId?: string | null;
}
export interface QueryPage<R> {
  rows: R[];
  rowCount: number;
}
