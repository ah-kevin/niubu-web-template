import { createContext, useContext, useSyncExternalStore } from 'react';
import type { LocalLock, LockSnapshot, UpdateChecker } from '@niubu/hooks';
export type PlaygroundShellRuntime = { lock: LocalLock | null; updates: UpdateChecker; reloadPage(): void };
export const PlaygroundShellContext = createContext<PlaygroundShellRuntime | null>(null);
export const usePlaygroundShell = () => useContext(PlaygroundShellContext);
const idle: LockSnapshot = Object.freeze({ locked: false, pending: false, errorCode: null });
const subscribeIdle = () => () => {};
const readIdle = () => idle;
export function usePlaygroundLockSnapshot() {
  const owner = usePlaygroundShell()?.lock;
  return useSyncExternalStore(
    owner?.subscribe ?? subscribeIdle,
    owner?.getSnapshot ?? readIdle,
    owner?.getSnapshot ?? readIdle,
  );
}
