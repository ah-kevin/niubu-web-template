import { describe, expect, it } from 'vitest';
import { antPalette } from './ant-palette.ts';
import { defaultThemeAppearance, defaultThemeProfile, densityTokens, resolvePresentationTheme, themePresets } from './index.ts';

describe('design system roles', () => {
  it('changes only the content border while preserving all region borders and text colors', () => {
    for (const preset of themePresets) {
      for (const mode of ['light', 'dark'] as const) {
        const input = { ...defaultThemeAppearance, preset: preset.id };
        const tokens = resolvePresentationTheme(input, mode);
        const base = preset.id === 'default' || preset.id === 'custom';
        expect(tokens['--control-border']).toBe(base ? (mode === 'dark' ? '#4a4a50' : '#cdd0d6') : tokens['--border']);
        for (const region of ['sidebar', 'sidebar-submenu', 'header']) {
          expect(tokens[`--${region}-control-border`]).toBe(tokens['--border']);
          expect(tokens[`--${region}-primary-text`]).toBe(tokens['--primary']);
        }
      }
    }
  });

  it('derives content roles from each effective brand seed without changing the fill palette', () => {
    for (const primary of ['#006be6', '#7166f0', '#123456', '#fafafa']) {
      for (const mode of ['light', 'dark'] as const) {
        const tokens = resolvePresentationTheme({ ...defaultThemeAppearance, preset: 'custom', colorPrimary: primary }, mode);
        const light = antPalette(primary);
        const fill = antPalette(primary, mode === 'dark');
        expect(tokens['--primary-text']).toBe(mode === 'dark' ? light[3] : primary);
        expect(tokens['--primary-text-pressed']).toBe(light[mode === 'dark' ? 1 : 6]);
        expect(tokens['--nav-active-foreground']).toBe(tokens['--primary-text-pressed']);
        expect(tokens['--focus-ring']).toBe(mode === 'dark' ? light[3] : tokens['--ring']);
        expect(tokens['--primary-hover']).toBe(fill[mode === 'dark' ? 6 : 4]);
        expect(tokens['--primary-active']).toBe(fill[mode === 'dark' ? 4 : 6]);
        expect(tokens['--table-row-selected']).toBe('var(--nav-active)');
      }
    }
  });

  it('uses brand overrides and preserves independent half-dark region colors', () => {
    const tokens = resolvePresentationTheme(
      { ...defaultThemeAppearance, semiDarkSidebar: true, semiDarkSubmenu: true },
      'light',
      undefined,
      { '--primary': '#7166f0', '--ring': '#123456' },
    );
    expect(tokens['--focus-ring']).toBe('#123456');
    expect(tokens['--primary-text-pressed']).toBe('#514bc9');
    expect(tokens['--sidebar-primary-text']).toBe('#7166f0');
    expect(tokens['--sidebar-control-border']).toBe('#36363a');
    expect(tokens['--sidebar-submenu-control-border']).toBe('#36363a');
    expect(tokens['--header-control-border']).toBe('#e4e4e7');
  });

  it('retains explicit profile border and primary text overrides', () => {
    const profile = {
      ...defaultThemeProfile,
      dark: { ...defaultThemeProfile.dark, '--border': '#123456', '--primary-text': '#abcdef' },
    };
    const tokens = resolvePresentationTheme(defaultThemeAppearance, 'dark', profile);
    expect(tokens['--control-border']).toBe('#123456');
    expect(tokens['--primary-text']).toBe('#abcdef');
    expect(tokens['--sidebar-control-border']).toBe('#123456');
    expect(tokens['--sidebar-primary-text']).toBe('#abcdef');
  });

  it('exposes state colors, aliases and black dark popup shadows', () => {
    const dark = resolvePresentationTheme(defaultThemeAppearance, 'dark');
    expect(dark).toMatchObject({
      '--primary-text': '#52aeff', '--primary-text-pressed': '#a3daff', '--focus-ring': '#52aeff',
      '--disabled-foreground': '#5f6269', '--control-strong': '#7a7d85',
      '--success': '#34c26a', '--warning': '#f2a93b', '--info': '#3bb4d6',
      '--destructive-text': '#ff6b86', '--destructive-foreground': '#ffffff',
      '--table-header': '#2e3035', '--table-row-hover': '#22252a', '--switch-thumb': '#ffffff',
      '--tooltip': 'var(--foreground)', '--tooltip-foreground': 'var(--card)',
      '--skeleton': 'var(--border)', '--skeleton-highlight': 'var(--muted)',
      '--popup-shadow-sm': '0 1px 2px 0 rgba(0,0,0,0.4)',
      '--popup-shadow': '0 6px 16px 0 rgba(0,0,0,0.32), 0 3px 6px -4px rgba(0,0,0,0.48), 0 9px 28px 8px rgba(0,0,0,0.2)',
    });
    expect(dark['--shadow']).toBe(dark['--popup-shadow']);
    expect(dark['--sidebar-popup-shadow']).toBe(dark['--popup-shadow']);
    expect(dark).toMatchObject({ '--popover': '#242424', '--overlay-background': 'rgba(0,0,0,0.4)', '--control-error-hover': '#e85971' });
  });

  it('keeps fixed dimensions separate from density and retains existing density values', () => {
    const tokens = resolvePresentationTheme(defaultThemeAppearance, 'light');
    expect(tokens).toMatchObject({ '--dialog-width-md': '520px', '--z-dialog': '1020', '--control-icon-size': '16px' });
    expect(tokens).not.toHaveProperty('--control-check-size');
    expect(densityTokens.standard).toMatchObject({ '--heading-1-font-size': '24px', '--control-check-size': '16px', '--popup-padding': '24px', '--control-padding-inline': '11px' });
    expect(densityTokens.compact).toMatchObject({ '--heading-1-font-size': '20px', '--control-check-size': '14px', '--popup-padding': '16px', '--control-padding-inline': '7px' });
  });
});
