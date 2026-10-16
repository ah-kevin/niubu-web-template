import { expect, it } from 'vitest';
import * as design from './index.ts';

it('owns the complete pure Vben appearance and verified fifteen primary palettes', () => {
  expect(design).toHaveProperty('resolvePresentationTheme');
  expect(design.themePresets.map(item => item.id)).toEqual(['default', 'violet', 'sakura', 'lemon', 'sky', 'light-green', 'zinc', 'deep-green', 'deep-blue', 'orange', 'rose', 'neutral', 'slate', 'gray', 'custom']);
  expect(design.resolvePresentationTheme(design.defaultThemeAppearance, 'light')['--primary']).toBe('#006be6');
  expect(design.foundationDimensions).toEqual({ headerHeight: 50, tabbarHeight: 38, sidebarWidth: 224, collapsedWidth: 60, secondaryRailWidth: 80, footerHeight: 32 });
});
it('whitelists presentation values and does not mutate source intent', () => {
  const input = { ...design.defaultThemeAppearance, preset: 'custom', colorPrimary: 'url(x);color:red', radius: NaN, fontSize: Infinity, grayscale: 'yes', mode: 'system' };
  expect(design.validateThemeAppearancePatch(input)).not.toHaveProperty('colorPrimary');
  expect(design.validateThemeAppearancePatch(input)).not.toHaveProperty('radius');
  expect(design.validateThemeAppearancePatch(Object.create({ preset: 'violet', grayscale: true }))).toEqual({});
  expect(design.resolvePresentationTheme(input, 'light')['--primary']).toBe('#006be6');
  expect(input.colorPrimary).toBe('url(x);color:red');
});
function luminance(hex: string) {
  const full = hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;
  return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i]!, 0);
}
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
it('keeps exact primary, foreground, hover and readable text accessible for every palette and mode', () => {
  for (const preset of design.themePresets) for (const mode of ['light', 'dark'] as const) {
    const tokens = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: preset.id }, mode);
    expect(Object.isFrozen(tokens)).toBe(true);
    expect(tokens['--primary']).toBe(preset.id === 'custom' ? '#006be6' : preset[mode]);
    expect(contrast(tokens['--primary']!, tokens['--primary-foreground']!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--primary-hover']!, tokens['--primary-hover-foreground']!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--ring']!, tokens['--card']!)).toBeGreaterThanOrEqual(3);
    for (const surface of ['--background', '--card', '--secondary', '--muted', '--accent', '--sidebar', '--sidebar-submenu', '--header', '--nav-active', '--warm']) expect(contrast(tokens['--primary-text']!, tokens[surface]!)).toBeGreaterThanOrEqual(4.5);
  }
});
it('applies half-dark only to selected regions and validates custom extremes', () => {
  const tokens = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, semiDarkSidebar: true }, 'light');
  expect(tokens['--background']).toBe(design.defaultThemeProfile.light['--background']);
  expect(tokens['--sidebar']).toBe(design.defaultThemeProfile.dark['--sidebar']);
  expect(tokens['--header']).toBe(design.defaultThemeProfile.light['--header']);
  for (const colorPrimary of ['#fff', '#000', '#777777', '#ff0000', '#00ff00']) for (const mode of ['light', 'dark'] as const) {
    const t = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: 'custom', colorPrimary }, mode);
    expect(t['--primary']).toBe(colorPrimary);
    expect(contrast(t['--primary-hover']!, t['--primary-hover-foreground']!)).toBeGreaterThanOrEqual(4.5);
  }
});
it('retains distinct verified neutral/slate/gray semantic surfaces, not just primary swatches', () => {
  const zinc = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: 'zinc' }, 'dark');
  const neutral = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: 'neutral' }, 'dark');
  const slate = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: 'slate' }, 'dark');
  const gray = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: 'gray' }, 'dark');
  expect(zinc['--background']).not.toBe(neutral['--background']);
  expect(slate['--secondary']).not.toBe(gray['--secondary']);
  expect(neutral['--secondary']).not.toBe(slate['--secondary']);
});
it('provides independently accessible ring and text for every half-dark region and palette', () => {
  for (const preset of design.themePresets) {
    const tokens = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: preset.id, semiDarkSidebar: true, semiDarkSubmenu: true, semiDarkHeader: true }, 'light');
    for (const region of ['sidebar', 'sidebar-submenu', 'header']) {
      expect(contrast(tokens[`--${region}-ring`]!, tokens[`--${region}`]!)).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens[`--${region}-primary-text`]!, tokens[`--${region}`]!)).toBeGreaterThanOrEqual(4.5);
      for (const surface of ['background', 'warm', 'muted', 'card', 'secondary', 'accent', 'nav-active']) {
        expect(contrast(tokens[`--${region}-ring`]!, tokens[`--${region}-${surface}`]!)).toBeGreaterThanOrEqual(3);
        expect(contrast(tokens[`--${region}-primary-text`]!, tokens[`--${region}-${surface}`]!)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
