import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createAppStores, type AppStores } from './instance';
import { InteractionContext } from './interaction';
import { StoresContext } from './react-context';
function InteractionBinding({ stores, children }: { stores: AppStores; children: ReactNode }) {
  const { dirty } = useSyncExternalStore(
    stores.interaction.subscribe,
    stores.interaction.getSnapshot,
    stores.interaction.getSnapshot,
  );
  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!stores.interaction.navigationAllowed()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [stores, dirty]);
  return <InteractionContext value={{ ...stores.interaction, dirty }}>{children}</InteractionContext>;
}
/** Explicit caller-owned app instances are never disposed by Provider replay. */
export function StoresProvider({ stores, children }: { stores: AppStores; children: ReactNode }) {
  return (
    <StoresContext value={stores}>
      <InteractionBinding stores={stores}>{children}</InteractionBinding>
    </StoresContext>
  );
}
/** Standalone form fixtures own the same memory implementation, without app/runtime state. */
export function InteractionProvider({ children }: { children: ReactNode }) {
  const [stores] = useState(() => createAppStores({ identityKey: 'standalone-form', readContext: null }));
  const lifecycle = useRef({ generation: 0 });
  useEffect(() => {
    const lifetime = lifecycle.current;
    const generation = ++lifetime.generation;
    return () => {
      queueMicrotask(() => {
        if (lifetime.generation === generation) stores.dispose();
      });
    };
  }, [stores]);
  return <InteractionBinding stores={stores}>{children}</InteractionBinding>;
}

/** Reuses the one app interaction owner; no extra unload listener or altered draft tuple. */
export function PageInteractionBinding({
  stores,
  pageKey,
  children,
}: {
  stores: AppStores;
  pageKey: string;
  children: ReactNode;
}) {
  const { dirty } = useSyncExternalStore(
    stores.interaction.subscribe,
    stores.interaction.getSnapshot,
    stores.interaction.getSnapshot,
  );
  const binding = useMemo(() => stores.interaction.forPage(pageKey), [stores, pageKey]);
  return <InteractionContext value={{ ...binding, dirty }}>{children}</InteractionContext>;
}
