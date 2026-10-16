import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createFullscreenController, type FullscreenSnapshot } from '@niubu/hooks';
function createFullscreenStore() {
  let snapshot: FullscreenSnapshot = { status: 'unsupported', active: false };
  let controller: ReturnType<typeof createFullscreenController> | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      const owner = createFullscreenController({ document });
      controller = owner;
      const update = () => {
        snapshot = owner.getSnapshot();
        listeners.forEach(listener => listener());
      };
      const unsubscribe = owner.subscribe(update);
      update();
      return () => {
        if (controller === owner) controller = null;
        unsubscribe();
        owner.dispose();
      };
    },
    toggle: () => controller?.toggle(),
  };
}
export function useFullscreen() {
  const store = useMemo(() => createFullscreenStore(), []);
  useEffect(() => store.connect(), [store]);
  return {
    snapshot: useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot),
    toggle: store.toggle,
  };
}
