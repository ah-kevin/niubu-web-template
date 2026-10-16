import { defaultThemeProfile, semanticTokenKeys } from './tokens.ts';
import type { BrandOverride, BrandToken, ResolvedTheme, ThemeProfile } from './types.ts';

const hexColor = /^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8})$/i;
const brandKeys: readonly BrandToken[] = ['--primary', '--primary-foreground', '--ring', '--accent'];
const shadowValue = /^(?:(?:0|-?\d+(?:\.\d+)?px)\s+){2,4}(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8})$/i;

/** Whitelist unknown runtime input too; no arbitrary CSS reaches a style target. */
export function validateBrandOverride(input: unknown): BrandOverride {
  const result: Partial<Record<BrandToken, string>> = {};
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    for (const key of brandKeys) {
      const value = Object.hasOwn(input, key) ? (input as Record<string, unknown>)[key] : undefined;
      if (typeof value === 'string' && hexColor.test(value)) result[key] = value;
    }
  }
  return Object.freeze(result);
}

/** Semantic theme only: density is controlled by its separate CSS selector. */
export function resolveTheme(
  profile: ThemeProfile,
  mode: ResolvedTheme,
  brand: BrandOverride = {},
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  const values = profile?.[mode];
  for (const key of semanticTokenKeys) {
    const value = values && Object.hasOwn(values, key) ? values[key] : undefined;
    const pattern = key === '--shadow' ? shadowValue : hexColor;
    result[key] = typeof value === 'string' && pattern.test(value) ? value : defaultThemeProfile[mode][key];
  }
  return Object.freeze({ ...result, ...validateBrandOverride(brand) });
}
