import type { ScopeRef } from '@niubu/types';
import type { PlaygroundUser } from './schemas';

export const invalidScope: ScopeRef = Object.freeze({ kind: 'invalid', id: 'invalid' });
export const equalScope = (a: ScopeRef | null, b: ScopeRef | null) =>
  a === null ? b === null : b !== null && a.kind === b.kind && a.id === b.id;
export function readPlaygroundScope(search: string, user: PlaygroundUser | null) {
  const params = new URLSearchParams(search),
    kinds = params.getAll('scopeKind'),
    ids = params.getAll('scopeId');
  if (!kinds.length && !ids.length) return { valid: true, explicit: false, scope: user?.workspaces[0] ?? null };
  if (
    kinds.length !== 1 ||
    ids.length !== 1 ||
    kinds[0] !== 'workspace' ||
    !['north', 'south'].includes(ids[0]) ||
    (user !== null && !user.workspaces.some(scope => scope.kind === kinds[0] && scope.id === ids[0]))
  )
    return { valid: false, explicit: true, scope: invalidScope };
  return { valid: true, explicit: true, scope: { kind: 'workspace', id: ids[0] } as ScopeRef };
}
export function withScope(search: string, scope: ScopeRef | null) {
  const params = new URLSearchParams(search);
  params.delete('scopeKind');
  params.delete('scopeId');
  if (scope) {
    params.set('scopeKind', scope.kind);
    params.set('scopeId', scope.id);
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}
