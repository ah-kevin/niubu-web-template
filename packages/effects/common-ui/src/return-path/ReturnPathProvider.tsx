import type { ReactNode } from 'react';
import type { ReturnPathResolver } from '@niubu/core-shared';
import { ReturnPathContext } from './binding';

/** Routing policy belongs to the caller; each mounted binding is independent. */
export function ReturnPathProvider({
  resolveReturnPath,
  children,
}: {
  resolveReturnPath: ReturnPathResolver;
  children: ReactNode;
}) {
  return <ReturnPathContext value={resolveReturnPath}>{children}</ReturnPathContext>;
}
