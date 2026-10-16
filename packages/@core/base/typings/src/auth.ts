import type { ScopeRef } from './context';
import type { BackendMenuItem } from './menu';

/** The platform supplies its signal type; the pure contract imports no DOM or Node APIs. */
export type AuthOperation<Signal = unknown> = Readonly<{
  signal: Signal;
  assertCurrent(): void;
}>;
export type AuthUser<K extends string = string> = Readonly<{
  id: string;
  name: string;
  roles: readonly string[];
  workspaces: readonly ScopeRef<K>[];
}>;
export type AuthCredentials = Readonly<{
  headers?: Readonly<Record<string, string>>;
  credentials?: 'omit' | 'same-origin' | 'include';
}>;
export interface AuthAdapter<U extends AuthUser, L, Signal = unknown> {
  restore(op: AuthOperation<Signal>): Promise<U | null>;
  login(input: L, op: AuthOperation<Signal>): Promise<U>;
  logout(op: AuthOperation<Signal>): Promise<void>;
  refresh(op: AuthOperation<Signal>): Promise<void>;
  getCodes(scope: ScopeRef | null, op: AuthOperation<Signal>): Promise<readonly string[]>;
  getMenu(scope: ScopeRef | null, op: AuthOperation<Signal>): Promise<readonly BackendMenuItem[]>;
  credentialsProvider(signal: Signal): AuthCredentials | Promise<AuthCredentials>;
  invalidateLocal(): void;
}
export type AuthContext = Readonly<{
  identityKey: string;
  scope: ScopeRef | null;
  generation: number;
}>;
