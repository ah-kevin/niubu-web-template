import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { PreferenceExtension } from '@niubu/core-preferences';
import type { PreferenceManager } from './manager.ts';
export const PreferenceContext = createContext<PreferenceManager | null>(null);
export const useOptionalPreferenceManager = () => useContext(PreferenceContext);
export function usePreferenceManager() {
  const manager = useOptionalPreferenceManager();
  if (!manager) throw Error('PreferenceProvider is required');
  return manager;
}
export function usePreferenceSnapshot() {
  const manager = usePreferenceManager();
  return useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
}
export function usePreferenceExtension<T>(definition: PreferenceExtension<T>, options?: { scopeKey: string }) {
  const manager = usePreferenceManager();
  const scopeKey = options?.scopeKey;
  const handle = useMemo(
    () => manager.registerExtension(definition, scopeKey === undefined ? undefined : { scopeKey }),
    [manager, definition, scopeKey],
  );
  const value = useSyncExternalStore(manager.subscribe, handle.get, handle.get);
  return { value, update: handle.update, reset: handle.reset };
}
