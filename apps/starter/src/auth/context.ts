import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AuthSession } from '@niubu/stores';
import type { LoginInput, StarterUser } from './schemas';

export type StarterAuth = AuthSession<StarterUser, LoginInput>;
export const StarterAuthContext = createContext<StarterAuth | null>(null);
export function useStarterAuth() {
  const owner = useContext(StarterAuthContext);
  if (!owner) throw new Error('Starter auth owner is missing');
  return owner;
}
export function useAuthSnapshot() {
  const owner = useStarterAuth();
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
}
