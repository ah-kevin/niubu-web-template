import type { ReadContext } from '@niubu/core-typings';
import type { InteractionState } from './interaction';
import { createTabStore } from './tabs';
type Session = Readonly<{ identityKey: string; disposed: boolean }>;
type Workspace = Readonly<{ readContext: ReadContext | null }>;
type UI = Readonly<{ mobileOpen: boolean; localeError: string | null }>;
export type AppStoreSnapshot = Readonly<{
  session: Session;
  workspace: Workspace;
  ui: UI;
  interaction: Readonly<{ dirty: boolean }>;
}>;
export type AppStores = ReturnType<typeof createAppStores>;
function immutable<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
}
/** Per-app memory only. No business entity cache, persistence or authentication. */
export function createAppStores(options: { identityKey: string; readContext: ReadContext | null }) {
  if (!options.identityKey) throw Error('Store identity is required');
  let disposed = false;
  let snapshot: AppStoreSnapshot = immutable({
    session: { identityKey: options.identityKey, disposed: false },
    workspace: { readContext: structuredClone(options.readContext) },
    ui: { mobileOpen: false, localeError: null },
    interaction: { dirty: false },
  });
  const listeners = new Set<() => void>();
  const active = new Set<string>();
  const drafts = new Map<string, unknown>();
  let approved = false;
  const pageBindings = new Map<string, Omit<InteractionState, 'dirty'>>();
  const pageDirty = new Map<string, Set<string>>();
  const draftOwners = new Map<string, Set<string>>();
  const isPageProtected = (page: string) =>
    !!pageDirty.get(page)?.size || [...draftOwners.values()].some(owners => owners.has(page));
  const tabs = createTabStore({ home: null, isProtected: isPageProtected });
  const subscribe = (listener: () => void) => {
    if (!disposed) listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  function publish(next: AppStoreSnapshot) {
    snapshot = immutable(next);
    for (const listener of listeners) listener();
  }
  const interaction: Omit<InteractionState, 'dirty'> & {
    getSnapshot(): AppStoreSnapshot['interaction'];
    subscribe: typeof subscribe;
    forPage(page: string): Omit<InteractionState, 'dirty'>;
    isPageProtected(page: string): boolean;
  } = {
    getSnapshot: () => snapshot.interaction,
    subscribe,
    setDirty(key, dirty) {
      if (disposed || active.has(key) === dirty) return;
      if (dirty) active.add(key);
      else active.delete(key);
      publish({ ...snapshot, interaction: { dirty: active.size > 0 } });
    },
    readDraft: (scope, key) => drafts.get(JSON.stringify([scope, key])),
    writeDraft(scope, key, value) {
      if (!disposed) drafts.set(JSON.stringify([scope, key]), structuredClone(value));
    },
    removeDraft(scope, key) {
      if (!disposed) {
        const tuple = JSON.stringify([scope, key]);
        drafts.delete(tuple);
        draftOwners.delete(tuple);
      }
    },
    runWithoutGuard(action) {
      if (disposed) return;
      const previous = approved;
      approved = true;
      try {
        action();
      } finally {
        approved = previous;
      }
    },
    navigationAllowed: () => approved,
    isPageProtected,
    forPage(page) {
      const existing = pageBindings.get(page);
      if (existing) return existing;
      const binding: Omit<InteractionState, 'dirty'> = {
        setDirty(key, dirty) {
          if (disposed) return;
          const keys = pageDirty.get(page) ?? new Set<string>();
          if (dirty) keys.add(key);
          else keys.delete(key);
          pageDirty.set(page, keys);
          interaction.setDirty(JSON.stringify([page, key]), dirty);
        },
        readDraft: interaction.readDraft,
        writeDraft(scope, key, value) {
          if (disposed) return;
          const tuple = JSON.stringify([scope, key]);
          const owners = draftOwners.get(tuple) ?? new Set<string>();
          owners.add(page);
          draftOwners.set(tuple, owners);
          interaction.writeDraft(scope, key, value);
        },
        removeDraft: interaction.removeDraft,
        runWithoutGuard: interaction.runWithoutGuard,
        navigationAllowed: interaction.navigationAllowed,
      };
      pageBindings.set(page, binding);
      return binding;
    },
  };
  return {
    getSnapshot: () => snapshot,
    subscribe,
    interaction,
    tabs,
    session: { getSnapshot: () => snapshot.session, subscribe },
    workspace: {
      getSnapshot: () => snapshot.workspace,
      subscribe,
      setReadContext(readContext: ReadContext | null) {
        if (!disposed) publish({ ...snapshot, workspace: { readContext: structuredClone(readContext) } });
      },
    },
    ui: {
      getSnapshot: () => snapshot.ui,
      subscribe,
      update(next: Partial<UI>) {
        if (disposed || Object.entries(next).every(([key, value]) => snapshot.ui[key as keyof UI] === value)) return;
        publish({ ...snapshot, ui: { ...snapshot.ui, ...next } });
      },
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active.clear();
      drafts.clear();
      pageBindings.clear();
      pageDirty.clear();
      draftOwners.clear();
      tabs.dispose();
      approved = false;
      listeners.clear();
      snapshot = immutable({
        ...snapshot,
        session: { ...snapshot.session, disposed: true },
        interaction: { dirty: false },
        ui: { mobileOpen: false, localeError: null },
      });
    },
  };
}
