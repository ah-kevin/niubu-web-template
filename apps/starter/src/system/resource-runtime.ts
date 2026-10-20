import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AuthContext } from '@niubu/types';
import type { RequestOutcome } from '@niubu/request';
import type { StarterApi } from '../api';
import { starterScopeQueryKey } from '../auth/query-context';
import { SystemRequestError, unwrapSystemResult } from './api';
import type { RecordByResource, ResourceKind, SystemCrudPort } from './contracts';
import { resourceConfig, type Translate } from './resource-config';

export const cancelled = () => new DOMException('System operation cancelled', 'AbortError');
export function sameOwner(a: AuthContext, b: AuthContext | null): boolean {
  return (
    b !== null && a.identityKey === b.identityKey && a.scope?.kind === b.scope?.kind && a.scope?.id === b.scope?.id
  );
}
export function currentLease(api: StarterApi, captured: AuthContext, signal: AbortSignal): boolean {
  const current = api.getContext();
  return !signal.aborted && sameOwner(captured, current) && captured.generation === current?.generation;
}
export function requireLease(api: StarterApi, captured: AuthContext, signal: AbortSignal) {
  if (!currentLease(api, captured, signal)) throw cancelled();
}
export class ReconfirmSystemWrite extends Error {}
/** Expiry recovery uses the existing idempotent coordinator. Never retries a write. */
export async function writeWithRecovery<K extends ResourceKind, T>(
  api: StarterApi,
  port: SystemCrudPort<K>,
  context: AuthContext,
  signal: AbortSignal,
  write: () => Promise<RequestOutcome<T>>,
): Promise<T> {
  const result = await write();
  requireLease(api, context, signal);
  if (
    !result.ok &&
    result.error.kind === 'http' &&
    result.error.status === 401 &&
    result.error.code === 'ACCESS_EXPIRED'
  ) {
    unwrapSystemResult(await port.list(context, { pageIndex: 0, pageSize: 1 }, signal));
    requireLease(api, context, signal);
    throw new ReconfirmSystemWrite();
  }
  return unwrapSystemResult(result);
}
export function systemErrorCopy(error: unknown, t: Translate): string {
  if (error instanceof ReconfirmSystemWrite) return t('system.reconfirmWrite');
  if (error instanceof SystemRequestError) {
    const { status, code } = error.requestError;
    if (status === 403) return t('system.writeForbidden');
    if (status === 404) return t('system.recordMissing');
    if (status === 409) return t('system.conflict');
    if (status === 400 || code === 'VALIDATION_ERROR') return t('system.invalidRequest');
  }
  return t('system.requestFailed');
}
export async function invalidateResource(client: QueryClient, context: AuthContext, resource: ResourceKind) {
  await client.invalidateQueries({
    queryKey: starterScopeQueryKey(context, 'system', resource),
    refetchType: 'none',
  });
}
async function loadRolesLookup(
  api: StarterApi,
  context: AuthContext,
  signal: AbortSignal,
): Promise<readonly RecordByResource['roles'][]> {
  const all: RecordByResource['roles'][] = [];
  for (let pageIndex = 0; ; pageIndex++) {
    const page = unwrapSystemResult(await api.system.roles.list(context, { pageIndex, pageSize: 100 }, signal));
    requireLease(api, context, signal);
    all.push(...page.rows);
    if (all.length >= page.rowCount) return all;
    if (page.rows.length === 0) throw new Error('Incomplete lookup page');
  }
}
export function useResourceLookups(
  api: StarterApi,
  resource: ResourceKind,
  context: AuthContext | null,
  sessionSignal: AbortSignal,
  enabled: boolean,
) {
  const client = useQueryClient();
  const needed: readonly string[] = resourceConfig[resource].lookups;
  function options<T>(
    kind: 'roles' | 'departments' | 'menus',
    load: (captured: AuthContext, signal: AbortSignal) => Promise<readonly T[]>,
  ) {
    return {
      queryKey: context
        ? starterScopeQueryKey(context, 'system', kind, kind === 'roles' ? 'lookup' : 'tree')
        : ['system', kind, 'inactive'],
      enabled: enabled && context !== null && needed.includes(kind),
      retry: false as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        if (!context) throw cancelled();
        return load(context, AbortSignal.any([signal, sessionSignal]));
      },
    };
  }
  const roles = useQuery(options('roles', (captured, signal) => loadRolesLookup(api, captured, signal))),
    departments = useQuery(
      options('departments', async (captured, signal) => {
        const snapshot = unwrapSystemResult(await api.system.departments.tree(captured, signal));
        requireLease(api, captured, signal);
        return snapshot.rows;
      }),
    ),
    menus = useQuery(
      options('menus', async (captured, signal) => {
        const snapshot = unwrapSystemResult(await api.system.menus.tree(captured, signal));
        requireLease(api, captured, signal);
        return snapshot.rows;
      }),
    );
  const results = { roles, departments, menus };
  const lookups = useMemo(
    () => ({ roles: roles.data ?? [], departments: departments.data ?? [], menus: menus.data ?? [] }),
    [roles.data, departments.data, menus.data],
  );
  return {
    lookups,
    ready: enabled && needed.every(kind => results[kind as keyof typeof results].isSuccess),
    error: needed.map(kind => results[kind as keyof typeof results].error).find(Boolean),
    retry: () => {
      for (const kind of needed)
        void client.invalidateQueries({
          queryKey: context ? starterScopeQueryKey(context, 'system', kind, kind === 'roles' ? 'lookup' : 'tree') : [],
        });
    },
  };
}
