import { vbenControlTheme } from './vben-control-theme.ts';
import { designSystemDimensions } from './design-system-tokens.ts';
import { defaultThemeProfile, semanticTokenKeys } from './tokens.ts';
import { resolveTheme, validateBrandOverride } from './resolve-theme.ts';
import { isThemePresetId, themePresets } from './theme-presets.ts';
import type { BrandOverride, ResolvedTheme, ThemeAppearance, ThemeProfile, SemanticToken } from './types.ts';

export const defaultThemeAppearance: Readonly<ThemeAppearance> = Object.freeze({
  mode: 'system',
  preset: 'default',
  colorPrimary: '#006be6',
  radius: 0.5,
  fontSize: 16,
  semiDarkSidebar: false,
  semiDarkSubmenu: false,
  semiDarkHeader: false,
  colorWeak: false,
  grayscale: false,
});
export const isPresentationColor = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:#[\da-f]{3}|#[\da-f]{6})$/i.test(value);
export const isThemeRadius = (value: unknown): value is ThemeAppearance['radius'] =>
  [0, 0.25, 0.5, 0.75, 1].includes(value as number);
export const isThemeFontSize = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 15 && value <= 22;
export function validateThemeAppearancePatch(input: unknown): Partial<ThemeAppearance> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return {};
  const own = (key: string) => (Object.hasOwn(input, key) ? (input as Record<string, unknown>)[key] : undefined);
  const result: Partial<ThemeAppearance> = {};
  const mode = own('mode'),
    preset = own('preset'),
    color = own('colorPrimary'),
    radius = own('radius'),
    size = own('fontSize');
  if (mode === 'light' || mode === 'dark' || mode === 'system') result.mode = mode;
  if (isThemePresetId(preset)) result.preset = preset;
  if (isPresentationColor(color)) result.colorPrimary = color.toLowerCase();
  if (isThemeRadius(radius)) result.radius = radius;
  if (isThemeFontSize(size)) result.fontSize = size;
  for (const key of ['semiDarkSidebar', 'semiDarkSubmenu', 'semiDarkHeader', 'colorWeak', 'grayscale'] as const) {
    const value = own(key);
    if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}
/** Pure canonical output; half-dark affects selected regions, never the main content. */
export function resolvePresentationTheme(
  input: unknown,
  mode: ResolvedTheme,
  profile: ThemeProfile = defaultThemeProfile,
  brand: BrandOverride = {},
): Readonly<Record<string, string>> {
  const appearance = { ...defaultThemeAppearance, ...validateThemeAppearancePatch(input) };
  const preset = themePresets.find(item => item.id === appearance.preset)!;
  const overridesFor = (localMode: ResolvedTheme) => {
    const resolved = resolveTheme(profile, localMode),
      profileChanges: Partial<Record<SemanticToken, string>> = {};
    // Default-derived values are baselines, not new palette seeds, even in copied profiles.
    for (const key of semanticTokenKeys)
      if (resolved[key] !== defaultThemeProfile[localMode][key]) profileChanges[key] = resolved[key];
    return { ...profileChanges, ...validateBrandOverride(brand) };
  };
  const overrides = overridesFor(mode);
  const primary = overrides['--primary'] ?? (appearance.preset === 'custom' ? appearance.colorPrimary : preset[mode]);
  const tokens = vbenControlTheme(preset.id, mode, primary, overrides);
  const regions: Record<string, string> = {};
  for (const [region, enabled] of [
    ['sidebar', appearance.semiDarkSidebar],
    ['sidebar-submenu', appearance.semiDarkSubmenu],
    ['header', appearance.semiDarkHeader],
  ] as const) {
    const regionMode = mode === 'light' && enabled ? 'dark' : mode;
    const localOverrides = overridesFor(regionMode);
    const local = vbenControlTheme(
      preset.id,
      regionMode,
      localOverrides['--primary'] ?? (preset.id === 'custom' ? appearance.colorPrimary : preset[regionMode]),
      localOverrides,
      'region',
    );
    regions[`--${region}`] = local[`--${region}`]!;
    regions[`--${region}-foreground`] = local[`--${region}-foreground`]!;
    regions[`--${region}-primary-text`] = local['--primary-text'];
    regions[`--${region}-ring`] = local['--ring'];
    for (const [key, value] of Object.entries(local)) {
      if (
        key.startsWith('--control-') ||
        [
          '--popover',
          '--popover-foreground',
          '--card-foreground',
          '--secondary-foreground',
          '--accent-foreground',
          '--accent-hover',
          '--primary-hover',
          '--primary-active',
          '--popup-shadow',
        ].includes(key)
      )
        regions[`--${region}-${key.slice(2)}`] = value;
    }
    for (const role of [
      'background',
      'warm',
      'muted',
      'muted-foreground',
      'nav-active',
      'accent',
      'card',
      'secondary',
      'border',
      'control-border',
      'placeholder',
      'destructive',
    ] as const)
      regions[`--${region}-${role}`] = local[`--${role}`]!;
  }
  return Object.freeze({
    ...tokens,
    ...designSystemDimensions,
    ...regions,
    '--radius': `${appearance.radius}rem`,
    '--control-radius': `${appearance.radius * 16}px`,
    // Vben's Ant bridge multiplies rem intent by 16; Ant genRadius supplies the variants.
    '--control-radius-sm': `${{ 0: 0, 0.25: 4, 0.5: 6, 0.75: 6, 1: 8 }[appearance.radius]}px`,
    '--control-radius-lg': `${{ 0: 0, 0.25: 4, 0.5: 10, 0.75: 14, 1: 16 }[appearance.radius]}px`,
    '--control-radius-xs': `${appearance.radius === 0 ? 0 : appearance.radius === 0.25 ? 1 : 2}px`,
    '--control-radius-outer': `${appearance.radius === 0 ? 0 : appearance.radius === 0.25 ? 4 : 6}px`,
    '--font-size-base': `${appearance.fontSize}px`,
  });
}
