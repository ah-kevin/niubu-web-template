import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createShortcutRuntime, type ShortcutActions } from '@niubu/hooks';
import { useOptionalPreferenceManager } from '@niubu/preferences';
import { corePreferenceDefaults } from '@niubu/core-preferences';
const emptySubscribe = () => () => {};
const emptySnapshot = () => ({ core: corePreferenceDefaults, persistence: null });
const standaloneSnapshot = emptySnapshot();
const getStandaloneSnapshot = () => standaloneSnapshot;
import { cancelTopPendingOverlay } from '@niubu/layout-ui/overlay-cancellation';
/** The shell installs one dispatcher. Standalone launchers opt into only their own action. */
export function useShellShortcuts(
  actions: Partial<Pick<ShortcutActions, 'search' | 'preferences'>>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const manager = useOptionalPreferenceManager();
  const { core } = useSyncExternalStore(
    manager?.subscribe ?? emptySubscribe,
    manager?.getSnapshot ?? getStandaloneSnapshot,
    manager?.getSnapshot ?? getStandaloneSnapshot,
  );
  const runtime = useRef<ReturnType<typeof createShortcutRuntime> | null>(null);
  useEffect(() => {
    const owner = createShortcutRuntime({
      target: window,
      platform: navigator.platform,
      preferences: {
        ...core.shortcut,
        enabled: enabled && core.shortcut.enabled,
        globalSearch: Boolean(actions.search) && core.shortcut.globalSearch,
        globalPreferences: Boolean(actions.preferences) && core.shortcut.globalPreferences,
      },
      actions: {
        search: actions.search ?? (() => {}),
        preferences: actions.preferences ?? (() => {}),
        cancelOverlay: event => cancelTopPendingOverlay(window, event),
      },
    });
    runtime.current = owner;
    return () => {
      owner.dispose();
      runtime.current = null;
    };
    // The following effect updates callbacks and preferences without registering another listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    runtime.current?.update({
      platform: navigator.platform,
      preferences: {
        ...core.shortcut,
        enabled: enabled && core.shortcut.enabled,
        globalSearch: Boolean(actions.search) && core.shortcut.globalSearch,
        globalPreferences: Boolean(actions.preferences) && core.shortcut.globalPreferences,
      },
      actions: {
        search: actions.search ?? (() => {}),
        preferences: actions.preferences ?? (() => {}),
        cancelOverlay: event => cancelTopPendingOverlay(window, event),
      },
    });
  }, [core.shortcut, actions.search, actions.preferences, enabled]);
}
