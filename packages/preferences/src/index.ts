export { createPreferenceManager, preferenceStorageKey } from './manager.ts';
export type { PreferenceIdentity, PreferenceManager, PreferenceSnapshot, ExtensionHandle } from './manager.ts';
export type { PersistenceResult } from './persistence.ts';
export { PreferenceProvider } from './react.tsx';
export {
  usePreferenceManager,
  useOptionalPreferenceManager,
  usePreferenceSnapshot,
  usePreferenceExtension,
} from './react-context.ts';

export { parsePreferenceEnvelope } from './pure.ts';

export { buildEffectiveConfiguration, copyEffectiveConfiguration } from './configuration.ts';
export type { EffectiveConfigurationExtension } from './configuration.ts';
