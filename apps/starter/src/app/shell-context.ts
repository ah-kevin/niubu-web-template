import { createContext, useContext, useSyncExternalStore } from 'react';
import type { LocalLock, LockSnapshot, UpdateChecker } from '@niubu/hooks';
export type StarterShellRuntime = { lock: LocalLock | null; updates: UpdateChecker; reloadPage(): void };
export const StarterShellContext = createContext<StarterShellRuntime | null>(null);
export const useStarterShell = () => useContext(StarterShellContext);
const idle: LockSnapshot = Object.freeze({ locked: false, pending: false, errorCode: null });
const subscribeIdle = () => () => {};
const readIdle = () => idle;
export function useStarterLockSnapshot() {
  const owner = useStarterShell()?.lock;
  return useSyncExternalStore(
    owner?.subscribe ?? subscribeIdle,
    owner?.getSnapshot ?? readIdle,
    owner?.getSnapshot ?? readIdle,
  );
}
