import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AppStores } from './instance';
export const StoresContext = createContext<AppStores | null>(null);
export function useAppStores() {
  const stores = useContext(StoresContext);
  if (!stores) throw Error('App stores provider is required');
  return stores;
}
export function useAppStoreSnapshot() {
  const stores = useAppStores();
  return useSyncExternalStore(stores.subscribe, stores.getSnapshot, stores.getSnapshot);
}
