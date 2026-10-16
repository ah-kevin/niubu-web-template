import type { AuthContext } from '@niubu/types';

export function snapshotTransferContext(context: AuthContext): AuthContext {
  return Object.freeze({
    identityKey: context.identityKey,
    generation: context.generation,
    scope: context.scope ? Object.freeze({ kind: context.scope.kind, id: context.scope.id }) : null,
  });
}

export function sameTransferContext(captured: AuthContext, current: AuthContext | null): boolean {
  return (
    current !== null &&
    captured.identityKey === current.identityKey &&
    captured.generation === current.generation &&
    captured.scope?.kind === current.scope?.kind &&
    captured.scope?.id === current.scope?.id
  );
}
