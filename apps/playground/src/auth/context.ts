import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AuthSession } from '@niubu/stores';
import type { LoginInput, PlaygroundUser } from './schemas';

export type PlaygroundAuth = AuthSession<PlaygroundUser, LoginInput>;
export const PlaygroundAuthContext = createContext<PlaygroundAuth | null>(null);
export function usePlaygroundAuth() {
  const owner = useContext(PlaygroundAuthContext);
  if (!owner) throw new Error('Playground auth owner is missing');
  return owner;
}
export function useAuthSnapshot() {
  const owner = usePlaygroundAuth();
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
}
