import { defaultThemeProfile } from './tokens.ts';
import { resolveTheme } from './resolve-theme.ts';
import { isThemePresetId, themePresets, themePresetSurfaces } from './theme-presets.ts';
import type { ResolvedTheme, ThemeAppearance } from './types.ts';

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
const rgb = (hex: string): number[] => {
  const full = hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;
  return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
};
const luminance = (hex: string) =>
  rgb(hex)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const foreground = (color: string) =>
  contrast(color, '#ffffff') >= contrast(color, '#000000') ? '#ffffff' : '#000000';
const mix = (color: string, amount: number, mode: ResolvedTheme) =>
  '#' +
  rgb(color)
    .map(v =>
      Math.round(v * 255 * (1 - amount) + (mode === 'dark' ? 255 : 0) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const surfaceKeys = [
  '--background',
  '--card',
  '--secondary',
  '--muted',
  '--accent',
  '--sidebar',
  '--sidebar-submenu',
  '--header',
  '--nav-active',
  '--warm',
] as const;
function readableColor(color: string, surfaces: readonly string[], mode: ResolvedTheme, minimum: number): string {
  for (let n = 0; n <= 100; n++) {
    const candidate = mix(color, n / 100, mode);
    if (surfaces.every(surface => contrast(candidate, surface) >= minimum)) return candidate;
  }
  return mode === 'dark' ? '#ffffff' : '#000000';
}
/** Exact official surfaces with explicit accessibility adaptations for explanatory text and control boundaries. */
function semanticSurfaces(id: ThemeAppearance['preset'], mode: ResolvedTheme) {
  const tokens = { ...resolveTheme(defaultThemeProfile, mode), ...themePresetSurfaces[id][mode] };
  const backgrounds = surfaceKeys.map(key => tokens[key]!);
  const muted = readableColor(tokens['--muted-foreground']!, backgrounds, mode, 4.5);
  return {
    ...tokens,
    '--muted-foreground': muted,
    '--secondary-muted-foreground': muted,
    '--placeholder': muted,
    '--control-border': readableColor(tokens['--control-border']!, backgrounds, mode, 3),
  };
}
/** Pure canonical output; half-dark affects selected regions, never the main content. */
export function resolvePresentationTheme(input: unknown, mode: ResolvedTheme): Readonly<Record<string, string>> {
  const appearance = { ...defaultThemeAppearance, ...validateThemeAppearancePatch(input) };
  const preset = themePresets.find(item => item.id === appearance.preset)!;
  const primary = appearance.preset === 'custom' ? appearance.colorPrimary : preset[mode];
  const tokens = semanticSurfaces(preset.id, mode),
    hover = mix(primary, 0.08, mode);
  const regions: Record<string, string> = {};
  for (const [region, enabled] of [
    ['sidebar', appearance.semiDarkSidebar],
    ['sidebar-submenu', appearance.semiDarkSubmenu],
    ['header', appearance.semiDarkHeader],
  ] as const) {
    const regionMode = mode === 'light' && enabled ? 'dark' : mode;
    const local = regionMode === mode ? tokens : semanticSurfaces(preset.id, regionMode);
    regions[`--${region}`] = local[`--${region}`]!;
    regions[`--${region}-foreground`] = local[`--${region}-foreground`]!;
    const localBackgrounds = surfaceKeys.map(key => local[key]!);
    regions[`--${region}-primary-text`] = readableColor(primary, localBackgrounds, regionMode, 4.5);
    regions[`--${region}-ring`] = readableColor(primary, localBackgrounds, regionMode, 3);
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
    ...regions,
    '--primary': primary,
    '--primary-text': readableColor(
      primary,
      surfaceKeys.map(key => tokens[key]!),
      mode,
      4.5,
    ),
    '--primary-foreground': foreground(primary),
    '--primary-hover': hover,
    '--primary-hover-foreground': foreground(hover),
    '--ring': readableColor(
      primary,
      surfaceKeys.map(key => tokens[key]!),
      mode,
      3,
    ),
    '--radius': `${appearance.radius}rem`,
    '--font-size-base': `${appearance.fontSize}px`,
  });
}
