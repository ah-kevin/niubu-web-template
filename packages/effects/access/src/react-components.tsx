import type { ReactNode } from 'react';
import type { AccessMatchMode } from './permissions';
import { AccessContext, useAccess, type AccessValue } from './react-context';

export function AccessProvider({ value, children }: { value: AccessValue; children: ReactNode }) {
  return <AccessContext value={value}>{children}</AccessContext>;
}

export type AccessControlState = Readonly<{ allowed: boolean; disabled: boolean }>;
type AccessRender = (state: AccessControlState) => ReactNode;
export type AccessControlProps = Readonly<{
  codes?: readonly string[];
  roles?: readonly string[];
  mode?: AccessMatchMode;
  fallback?: ReactNode;
}> &
  ({ strategy?: 'hide'; children: ReactNode | AccessRender } | { strategy: 'disable'; children: AccessRender });

export function AccessControl({
  codes = [],
  roles = [],
  mode,
  strategy = 'hide',
  fallback = null,
  children,
}: AccessControlProps) {
  const access = useAccess();
  const allowed = access.hasCodes(codes, mode ?? 'all') && access.hasRoles(roles, mode ?? 'any');
  if (strategy === 'disable' && typeof children !== 'function')
    throw new Error('AccessControl disable strategy requires a render function');
  if (strategy === 'hide' && !allowed) return fallback;
  return typeof children === 'function' ? children({ allowed, disabled: !allowed }) : children;
}
