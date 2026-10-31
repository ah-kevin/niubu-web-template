import { describe, expect, it } from 'vitest';
import { defaultThemeProfile, densityTokens, resolveTheme } from './index.ts';
import type { BrandOverride, ThemeProfile } from './index.ts';
describe('pure theme tokens', () => {
  it('keeps existing light/dark semantics and omits dimensions from resolved inline tokens', () => {
    const light = resolveTheme(defaultThemeProfile, 'light');
    const dark = resolveTheme(defaultThemeProfile, 'dark');
    expect(light['--primary']).toBe('#006be6');
    expect(dark['--primary']).toBe('#006be6');
    expect(light['--shadow']).toBe('0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)');
    expect(dark['--shadow']).toBe('0 6px 16px 0 rgba(0,0,0,0.32), 0 3px 6px -4px rgba(0,0,0,0.48), 0 9px 28px 8px rgba(0,0,0,0.2)');
    expect(light).not.toHaveProperty('--space-page');
    expect(dark).not.toHaveProperty('--row-height');
    expect(densityTokens).toMatchObject({
      standard: {
        '--space-page': '32px', '--row-height': '42px',
        '--workspace-section-gap': '16px', '--workspace-card-padding': '16px',
        '--workspace-heading-gap': '12px', '--workspace-control-height': '32px',
      },
      compact: {
        '--space-page': '24px', '--row-height': '36px',
        '--workspace-section-gap': '12px', '--workspace-card-padding': '12px',
        '--workspace-heading-gap': '8px', '--workspace-control-height': '28px',
      },
    });
    expect(Object.isFrozen(light)).toBe(true);
  });
  it('preserves valid custom shadow lengths with independent unitless zero', () => {
    const shadow = '0 8px 24px #1c3a2510';
    const profile = { ...defaultThemeProfile, light: { ...defaultThemeProfile.light, '--shadow': shadow } };
    expect(resolveTheme(profile, 'light')['--shadow']).toBe(shadow);
    expect(resolveTheme(defaultThemeProfile, 'light')['--shadow']).toBe('0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)');
    expect(defaultThemeProfile.light['--shadow']).toBe('0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)');
  });
  it.each([
    '1 8px 24px #1c3a2510',
    '0 8 24px #1c3a2510',
    '0 8rem 24px #1c3a2510',
    '00 8px 24px #1c3a2510',
    '0 8px 24px red',
  ])('rejects invalid shadow %s', shadow => {
    const profile = { ...defaultThemeProfile, light: { ...defaultThemeProfile.light, '--shadow': shadow } };
    expect(resolveTheme(profile, 'light')['--shadow']).toBe(defaultThemeProfile.light['--shadow']);
  });
  it('accepts only four brand keys and hex lengths without modifying global tokens', () => {
    const result = resolveTheme(defaultThemeProfile, 'light', {
      '--primary': '#abc',
      '--primary-foreground': '#abcd',
      '--ring': '#aabbcc',
      '--accent': '#aabbccdd',
      '--destructive': '#000',
      '--shadow': '#000',
      '--space-page': '#000',
      '--arbitrary': '#000',
      'font-family': 'evil',
    } as BrandOverride);
    expect(result['--primary']).toBe('#abc');
    expect(result['--primary-foreground']).toBe('#abcd');
    expect(result['--ring']).toBe('#aabbcc');
    expect(result['--accent']).toBe('#aabbccdd');
    expect(result['--destructive']).toBe('#ff3860');
    expect(result).not.toHaveProperty('--arbitrary');
    expect(resolveTheme(defaultThemeProfile, 'light')['--primary']).toBe('#006be6');
  });
  it.each([
    'red',
    '#12',
    '#12345',
    '#1234567',
    '#123456789',
    ' #fff',
    '#ggg',
    'var(--evil)',
    'url(x); color:red',
    null,
  ])('drops invalid brand color %j', color => {
    expect(resolveTheme(defaultThemeProfile, 'dark', { '--primary': color } as BrandOverride)['--primary']).toBe(
      '#006be6',
    );
  });
  it('filters arbitrary profile keys and falls back missing/invalid semantic values', () => {
    const profile = {
      light: { ...defaultThemeProfile.light, '--evil': 'url(x)', '--primary': 'var(--evil)' },
      dark: {},
    };
    expect(resolveTheme(profile as unknown as ThemeProfile, 'light')).not.toHaveProperty('--evil');
    expect(resolveTheme(profile as unknown as ThemeProfile, 'light')['--primary']).toBe('#006be6');
    expect(resolveTheme(profile as unknown as ThemeProfile, 'dark')).toEqual(defaultThemeProfile.dark);
  });
});
