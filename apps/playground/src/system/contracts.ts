import type { AuthContext } from '@niubu/types';
import type { RequestOutcome } from '@niubu/request';
export type ResourceKind = 'users' | 'roles' | 'menus' | 'departments';
export type ResourceBase = { id: string };
export type UserInput = { name: string; email: string; roleId: string; departmentId: string; enabled: boolean };
export type RoleInput = { name: string; code: string; description: string; enabled: boolean };
export type DepartmentInput = { name: string; code: string; parentId: string | null; enabled: boolean };
export type MenuInput = {
  title: string;
  parentId: string | null;
  order: number;
  enabled: boolean;
  openInNewWindow?: boolean;
} & ({ kind: 'group' } | { kind: 'page'; pageId: string } | { kind: 'external'; href: string });
export type InputByResource = { users: UserInput; roles: RoleInput; menus: MenuInput; departments: DepartmentInput };
export type RecordByResource = {
  users: UserInput & ResourceBase;
  roles: RoleInput & ResourceBase;
  menus: MenuInput & ResourceBase;
  departments: DepartmentInput & ResourceBase;
};
export type SystemRecord = RecordByResource[ResourceKind];
export type SystemPage<Row> = { rows: readonly Row[]; rowCount: number };
export type CommonQuery = {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
  enabled?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};
export type QueryByResource = {
  users: CommonQuery & { roleId?: string; departmentId?: string };
  roles: CommonQuery;
  menus: CommonQuery & { kind?: MenuInput['kind'] };
  departments: CommonQuery & { parentId?: string | null };
};
export type SystemPort<K extends ResourceKind> = {
  list(
    context: AuthContext,
    query: QueryByResource[K],
    signal?: AbortSignal,
  ): Promise<RequestOutcome<SystemPage<RecordByResource[K]>>>;
  get(context: AuthContext, id: string, signal?: AbortSignal): Promise<RequestOutcome<RecordByResource[K]>>;
  create(
    context: AuthContext,
    input: InputByResource[K],
    signal?: AbortSignal,
  ): Promise<RequestOutcome<RecordByResource[K]>>;
  update(
    context: AuthContext,
    id: string,
    input: InputByResource[K],
    signal?: AbortSignal,
  ): Promise<RequestOutcome<RecordByResource[K]>>;
  remove(context: AuthContext, id: string, signal?: AbortSignal): Promise<RequestOutcome<{ id: string }>>;
};
export type SystemApi = { readonly [K in ResourceKind]: SystemPort<K> };
