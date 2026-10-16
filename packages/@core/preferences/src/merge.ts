import { corePreferenceDefaults } from './defaults.ts';
import { isPreferenceRecord, validateCorePreferencePatch } from './validate.ts';
import type { CorePreferences, DeepPartial, ResolvePreferencesOptions } from './types.ts';

const safeKey = (key: string) => !['__proto__', 'constructor', 'prototype'].includes(key);
function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (isPreferenceRecord(value))
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => safeKey(key))
        .map(([key, item]) => [key, clone(item)]),
    );
  return value;
}
function merge(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return clone(base);
  if (!isPreferenceRecord(patch)) return clone(patch);
  const result = isPreferenceRecord(base) ? (clone(base) as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(patch)) {
    if (safeKey(key) && value !== undefined) result[key] = merge(result[key], value);
  }
  return result;
}

/** For already validated JSON preference data. Arrays replace and all objects clone. */
export function mergeValidatedPreference<T>(base: T, override: DeepPartial<NoInfer<T>>): T {
  return merge(base, override) as T;
}
export function resolvePreferences(options: ResolvePreferencesOptions = {}): CorePreferences {
  let result: CorePreferences = mergeValidatedPreference<CorePreferences>(corePreferenceDefaults, {});
  for (const patch of [options.appDefaults, options.persisted, options.policy]) {
    result = mergeValidatedPreference(result, validateCorePreferencePatch(patch));
  }
  return result;
}
export function resetPreferences(options: Omit<ResolvePreferencesOptions, 'persisted'> = {}): CorePreferences {
  return resolvePreferences({ appDefaults: options.appDefaults, policy: options.policy });
}
