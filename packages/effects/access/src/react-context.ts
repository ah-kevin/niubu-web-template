import { createContext, useContext } from 'react';
import { matchesPermissions, type AccessMatchMode } from './permissions';

export type AccessValue = Readonly<{ codes: readonly string[]; roles: readonly string[]; ready: boolean }>;
export type AccessContextValue = AccessValue &
  Readonly<{
    hasCodes(required: readonly string[], mode?: AccessMatchMode): boolean;
    hasRoles(required: readonly string[], mode?: AccessMatchMode): boolean;
  }>;
export const AccessContext = createContext<AccessValue | null>(null);

export function useAccess(): AccessContextValue {
  const value = useContext(AccessContext);
  if (!value) throw new Error('useAccess requires an AccessProvider');
  return {
    ...value,
    hasCodes: (required, mode = 'all') => value.ready && matchesPermissions(value.codes, required, mode),
    hasRoles: (required, mode = 'any') => value.ready && matchesPermissions(value.roles, required, mode),
  };
}
