import type { RouteAccess, ScopeRef } from '@niubu/core-typings';
import { canAccess, requestedScope, sameScope, type AccessSnapshot } from './index';

export type BusinessScopeResult<K extends string> =
  { allowed: true; scope: ScopeRef<K> | null } | { allowed: false; state: 'forbidden' | 'no-access' };

/** K is registered by metadata and kinds; broad runtime inputs cannot enlarge it. */
export function resolveBusinessScope<K extends string>(
  meta: RouteAccess<K>,
  search: string,
  active: ScopeRef<string> | null,
  access: AccessSnapshot<string>,
  kinds: readonly K[],
): BusinessScopeResult<K> {
  const query = new URLSearchParams(search);
  const explicit = query.has('scopeKind') || query.has('scopeId');
  const candidateKind = kinds.find(kind => kind === (explicit ? query.get('scopeKind') : active?.kind));
  const candidateId = explicit ? query.get('scopeId') : active?.id;
  const candidate: ScopeRef<K> | null =
    candidateKind && typeof candidateId === 'string' ? { kind: candidateKind, id: candidateId } : null;
  const request = requestedScope(search, candidate, kinds);
  if (!request.valid) return { allowed: false, state: 'forbidden' };
  if (meta.scope !== 'account' && meta.scope !== 'public' && !request.scope)
    return { allowed: false, state: 'no-access' };
  const member = request.scope !== null && access.scopes.some(allowed => sameScope(allowed, request.scope));
  if ((explicit && !member) || !canAccess(meta, access, request.scope)) return { allowed: false, state: 'forbidden' };
  return { allowed: true, scope: member ? request.scope : null };
}
