import { expect, it } from 'vitest';
import * as design from './index.ts';
import { antPalette } from './ant-palette.ts';

it('treats value-equivalent default profile copies as the default across all presets and regions', () => {
  const copied = { light: { ...design.defaultThemeProfile.light }, dark: { ...design.defaultThemeProfile.dark } };
  for (const preset of design.themePresets) for (const mode of ['light', 'dark'] as const) {
    const appearance = { ...design.defaultThemeAppearance, preset: preset.id, semiDarkSidebar: true, semiDarkSubmenu: true, semiDarkHeader: true };
    expect(design.resolvePresentationTheme(appearance, mode, copied)).toEqual(design.resolvePresentationTheme(appearance, mode));
  }
});

it('matches the Vben Ant input palette and neutral roles without contrast remapping', () => {
  const tokens = { ...design.resolvePresentationTheme(design.defaultThemeAppearance, 'light'), ...design.densityTokens.standard };
  expect(tokens).toMatchObject({
    '--control-height': '32px', '--control-font-size': '14px', '--control-line-height': '22px',
    '--control-border': '#cdd0d6', '--control-background': '#ffffff',
    '--control-foreground': 'rgba(50,54,57,0.88)', '--control-placeholder': 'rgba(50,54,57,0.25)',
    '--control-disabled-background': 'rgba(50,54,57,0.04)', '--control-hover-border': '#278df2',
    '--control-primary': '#006be6', '--primary-hover': '#278df2', '--primary-active': '#0053bf',
    '--control-selected-background': '#e6f6ff', '--control-primary-border': '#7ac6ff',
    '--control-primary-border-hover': '#52aeff', '--control-focus-shadow': '0 0 0 2px rgba(5,165,255,0.1)',
    '--control-primary-shadow': '0 2px 0 rgba(5,165,255,0.1)',
    '--control-error-focus-shadow': '0 0 0 2px rgba(255,5,5,0.06)',
    '--muted-foreground': '#71717a', '--primary-text': '#006be6',
  });
});

it('keeps Ant control metrics independent of root font preferences and applies compact metrics through density', () => {
  const tokens = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, fontSize: 22 }, 'light');
  expect(tokens['--font-size-base']).toBe('22px');
  expect(tokens['--control-radius']).toBe('8px');
  expect(tokens['--control-radius-sm']).toBe('6px');
  expect(tokens['--control-radius-lg']).toBe('10px');
  expect(tokens).not.toHaveProperty('--control-font-size');
  expect(design.densityTokens.standard['--control-font-size']).toBe('14px');
  expect(design.densityTokens.compact).toMatchObject({
    '--control-height': '28px', '--control-font-size': '12px', '--control-line-height': '20px',
    '--control-height-sm': '21px', '--control-height-lg': '35px', '--control-padding-block': '3px',
  });
});

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
it('keeps every preset seed and source surfaces while exposing the Ant control palette', () => {
  for (const preset of design.themePresets) for (const mode of ['light', 'dark'] as const) {
    const tokens = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: preset.id }, mode);
    expect(Object.isFrozen(tokens)).toBe(true);
    expect(tokens['--primary']).toBe(preset.id === 'custom' ? '#006be6' : preset[mode]);
    expect(tokens['--primary-text']).toBe(mode === 'dark' ? antPalette(tokens['--primary']!)[3] : tokens['--primary']);
    expect(tokens['--control-border']).toBe(['default', 'custom'].includes(preset.id) ? (mode === 'dark' ? '#4a4a50' : '#cdd0d6') : tokens['--border']);
    expect(tokens['--primary-foreground']).toBe('#ffffff');
  }
});
it.each([
  ['violet', 'light', '#7166f0', '#a195fc', '#514bc9'],
  ['violet', 'dark', '#635acf', '#9388e5', '#5049a3'],
  ['custom', 'light', '#123456', '#254663', '#081b30'],
  ['custom', 'dark', '#122f4c', '#23415b', '#13293f'],
  ['zinc', 'light', '#18181b', '#262629', '#000000'],
  ['zinc', 'dark', '#d8d8d8', '#e8e8e8', '#aaaaaa'],
] as const)('uses official Ant colors fixtures for %s/%s', (preset, mode, primary, hover, active) => {
  const tokens = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset, colorPrimary: '#123456' }, mode);
  expect(tokens['--control-primary']).toBe(primary);
  expect(tokens['--primary-hover']).toBe(hover);
  expect(tokens['--primary-active']).toBe(active);
});
it('matches the independently captured Vben dark Ant tokens', () => {
  const tokens = design.resolvePresentationTheme(design.defaultThemeAppearance, 'dark');
  expect(tokens).toMatchObject({
    '--control-primary': '#035ec7', '--primary-hover': '#2581dc', '--primary-active': '#074d9d',
    '--control-background': '#1c1e23', '--control-border': '#4a4a50',
    '--control-foreground': 'rgba(242,242,242,0.85)', '--control-placeholder': 'rgba(242,242,242,0.25)',
    '--control-disabled-background': 'rgba(242,242,242,0.08)', '--control-selected-background': '#0e2e53',
    '--control-focus-shadow': '0 0 0 2px rgba(0,62,131,0.5)', '--destructive': '#dc3355',
    '--control-error-border': '#5b1f2b', '--control-error-focus-shadow': '0 0 0 2px rgba(76,0,8,0.33)',
    '--popover': '#242424',
  });
});
it('applies half-dark only to selected regions and validates custom extremes', () => {
  const tokens = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, semiDarkSidebar: true }, 'light');
  expect(tokens['--background']).toBe(design.defaultThemeProfile.light['--background']);
  expect(tokens['--sidebar']).toBe(design.defaultThemeProfile.dark['--sidebar']);
  expect(tokens['--header']).toBe(design.defaultThemeProfile.light['--header']);
  for (const colorPrimary of ['#fff', '#000', '#777777', '#ff0000', '#00ff00']) for (const mode of ['light', 'dark'] as const) {
    const t = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: 'custom', colorPrimary }, mode);
    expect(t['--primary']).toBe(colorPrimary);
    expect(t['--primary-foreground']).toBe('#ffffff');
    expect(t['--control-primary']).toMatch(/^#[a-f0-9]{6}$/);
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
it('projects the selected dark region without recoloring the light content', () => {
  const tokens = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, semiDarkSidebar: true, semiDarkSubmenu: true }, 'light');
  expect(tokens['--control-background']).toBe('#ffffff');
  expect(tokens['--sidebar-control-background']).toBe('#1c1e23');
  expect(tokens['--sidebar-submenu-control-background']).toBe('#1c1e23');
  expect(tokens['--sidebar-control-foreground']).toBe('rgba(242,242,242,0.85)');
  expect(tokens['--sidebar-control-primary']).toBe('#035ec7');
  expect(tokens['--header-control-background']).toBe('#ffffff');
  expect(tokens['--sidebar-popup-shadow']).toContain('rgba(0,0,0,0.32)');
  const neutral = design.resolvePresentationTheme({ ...design.defaultThemeAppearance, preset: 'zinc', semiDarkSidebar: true }, 'light');
  expect(neutral['--primary']).toBe('#18181b');
  expect(neutral['--sidebar-primary-text']).toBe('#fafafa');
});
