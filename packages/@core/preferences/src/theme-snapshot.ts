import { defaultThemeAppearance, validateThemeAppearancePatch } from '@niubu/core-design';
import { isDensity, isPreferenceRecord, isThemeMode } from './validate.ts';
import type { ThemeSnapshotV2 } from './types.ts';
/** Synchronous presentation only; legacy mode/density survive and top-level mode is authoritative. */
export function parseThemeSnapshot(input: unknown): ThemeSnapshotV2 {
  const valid =
    isPreferenceRecord(input) &&
    Object.hasOwn(input, 'schemaVersion') &&
    (input.schemaVersion === 1 || input.schemaVersion === 2);
  const mode = valid && Object.hasOwn(input, 'mode') && isThemeMode(input.mode) ? input.mode : 'system';
  const density = valid && Object.hasOwn(input, 'density') && isDensity(input.density) ? input.density : 'standard';
  const appearance =
    valid && input.schemaVersion === 2 && Object.hasOwn(input, 'appearance')
      ? validateThemeAppearancePatch(input.appearance)
      : {};
  return { schemaVersion: 2, mode, density, appearance: { ...defaultThemeAppearance, ...appearance, mode } };
}
