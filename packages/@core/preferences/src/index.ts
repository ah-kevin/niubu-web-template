export type {
  ThemeAppearance,
  ThemePresetId,
  LayoutMode,
  WidgetId,
  WidgetPosition,
  ThemeSnapshotV1,
  ThemeSnapshotV2,
  CorePreferences,
  DeepPartial,
  Density,
  Locale,
  PreferenceExtension,
  ResolvePreferencesOptions,
  ThemeMode,
  ThemeSnapshot,
} from './types.ts';
export { corePreferenceDefaults, vbenLayoutSourceKeys, widgetIds, preferenceLimits } from './defaults.ts';
export { isDensity, isLocale, isThemeMode, isPreferenceRecord, validateCorePreferencePatch } from './validate.ts';
export { mergeValidatedPreference, resolvePreferences, resetPreferences } from './merge.ts';
export { parseThemeSnapshot } from './theme-snapshot.ts';
