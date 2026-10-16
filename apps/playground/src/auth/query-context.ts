import type { AuthContext } from '@niubu/types';
import { appIdentity } from '../app/config';

export function playgroundScopeQueryKey(context: AuthContext, ...parts: readonly unknown[]) {
  return [
    appIdentity.storageNamespace,
    'identity',
    context.identityKey,
    'scope',
    context.scope?.kind ?? '',
    context.scope?.id ?? '',
    'generation',
    context.generation,
    ...parts,
  ] as const;
}
/** Cleanup captures an upper generation bound, so a later return to this scope survives. */
export function isRetiredScopeQuery(key: readonly unknown[], previous: AuthContext) {
  if (previous.scope === null) return false;
  const prefix = playgroundScopeQueryKey(previous).slice(0, 6);
  return (
    prefix.every((part, index) => key[index] === part) &&
    key[6] === 'generation' &&
    typeof key[7] === 'number' &&
    Number.isSafeInteger(key[7]) &&
    key[7] >= 0 &&
    key[7] <= previous.generation
  );
}
