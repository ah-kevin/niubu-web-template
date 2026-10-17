import { useFeaturesText } from './copy';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createStoragePort } from '@niubu/hooks/storage';
import { createPreferenceManager, PreferenceProvider, type PreferenceManager } from '@niubu/preferences';

function createSyntheticPreferenceStore() {
  let manager: PreferenceManager | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => manager,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      const values = new Map<string, string>();
      const owner = createPreferenceManager({
        identity: {
          product: 'synthetic',
          storageNamespace: 'playground-features',
          appId: 'examples',
          environment: 'synthetic',
          identityKey: 'synthetic-reader',
        },
        storage: createStoragePort({
          getItem: key => values.get(key) ?? null,
          setItem: (key, value) => {
            values.set(key, value);
          },
        }),
        appDefaults: { general: { watermark: false, watermarkText: '合成数据 · Playground' } },
      });
      manager = owner;
      listeners.forEach(listener => listener());
      return () => {
        if (manager === owner) manager = null;
        owner.dispose();
        values.clear();
      };
    },
  };
}

/** Each mounted scene owns an in-memory store; the host user's preferences are never read. */
export function SyntheticPreferences({ children }: { children: ReactNode }) {
  const { t } = useFeaturesText();
  const [store] = useState(createSyntheticPreferenceStore);
  const manager = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => store.connect(), [store]);
  return manager ? (
    <PreferenceProvider manager={manager}>{children}</PreferenceProvider>
  ) : (
    <p>{t('preferences.initializing')}</p>
  );
}
