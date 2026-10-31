import { useSyncExternalStore, type CSSProperties } from 'react';
import { defaultThemeAppearance, densityTokens, resolvePresentationTheme } from '@niubu/core-design';
import { useOptionalPreferenceManager } from '@niubu/preferences';

export type PreviewTheme = 'global' | 'light' | 'dark';
export type PreviewDensity = 'global' | 'standard' | 'compact';
const noSubscription = () => () => {};
const noSnapshot = () => null;

/** Inherit the app by default; explicit previews retain the configured palette and dimensions. */
export function usePreviewAppearance(theme: PreviewTheme, density: PreviewDensity) {
  const manager = useOptionalPreferenceManager();
  const snapshot = useSyncExternalStore(
    manager?.subscribe ?? noSubscription,
    manager?.getSnapshot ?? noSnapshot,
    manager?.getSnapshot ?? noSnapshot,
  );
  const style: CSSProperties = {
    ...(theme === 'global' ? {} : resolvePresentationTheme(snapshot?.core.theme ?? defaultThemeAppearance, theme)),
    ...(density === 'global' ? {} : densityTokens[density]),
    ...(theme === 'global' ? {} : { colorScheme: theme }),
  };
  return { style, theme: theme === 'global' ? undefined : theme, density: density === 'global' ? undefined : density };
}
