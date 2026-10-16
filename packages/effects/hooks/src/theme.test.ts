// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as hooks from './index.ts';
import type { ThemeSnapshot } from '@niubu/core-preferences';
import { defaultThemeAppearance, resolvePresentationTheme, themePresets } from '@niubu/core-design';
import type { BrandOverride, ThemeProfile } from '@niubu/core-design';

type Runtime = { apply(snapshot: ThemeSnapshot): void; setBrand(brand: BrandOverride): void; dispose(): void };
function media() {
  const listeners = new Set<() => void>();
  const query = {
    matches: false,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  return { matchMedia: () => query as unknown as MediaQueryList, listeners, change(value: boolean) {
    query.matches = value;
    [...listeners].forEach(fn => fn());
  } };
}
const snapshot = (mode: ThemeSnapshot['mode'], density: ThemeSnapshot['density'] = 'standard'): ThemeSnapshot => ({ schemaVersion: 1, mode, density });
function create(target: HTMLElement, m: ReturnType<typeof media>, brand: BrandOverride = {}, profile?: ThemeProfile) {
  const fn = (hooks as unknown as { createThemeRuntime?: (options: unknown) => Runtime }).createThemeRuntime;
  expect(typeof fn).toBe('function');
  return fn!({ target, matchMedia: m.matchMedia, brand, profile });
}
describe('theme runtime ownership', () => {
  it('keeps one system listener using the latest snapshot and brand, then detaches forced mode', () => {
    const target = document.createElement('div'), m = media();
    const runtime = create(target, m);
    runtime.apply(snapshot('system'));
    runtime.apply(snapshot('system', 'compact'));
    runtime.setBrand({ '--primary': '#123456' });
    expect(m.listeners.size).toBe(1);
    m.change(true);
    expect(target.dataset).toMatchObject({ theme: 'dark', density: 'compact' });
    expect(target.classList.contains('dark')).toBe(true);
    expect(target.style.getPropertyValue('--primary')).toBe('#123456');
    expect(target.style.getPropertyValue('--row-height')).toBe('');
    runtime.apply(snapshot('light', 'compact'));
    expect(m.listeners.size).toBe(0);
    m.change(true);
    expect(target.dataset.theme).toBe('light');
    runtime.apply(snapshot('system'));
    expect(m.listeners.size).toBe(1);
    runtime.dispose();
    expect(m.listeners.size).toBe(0);
  });
  it('restores semantic profile when all four brand overrides are removed and rejects arbitrary CSS', () => {
    const target = document.createElement('div'), m = media();
    const runtime = create(target, m, { '--primary': '#123', '--primary-foreground': '#456', '--ring': '#789', '--accent': '#abc' });
    runtime.apply(snapshot('dark'));
    runtime.setBrand({});
    expect(target.style.getPropertyValue('--primary')).toBe('#006be6');
    expect(target.style.getPropertyValue('--primary-foreground')).toBe('#ffffff');
    expect(target.style.getPropertyValue('--ring')).toBe(resolvePresentationTheme(defaultThemeAppearance, 'dark')['--ring']);
    expect(target.style.getPropertyValue('--accent')).toBe(resolvePresentationTheme(defaultThemeAppearance, 'dark')['--accent']);
    runtime.setBrand({ '--primary': 'url(secret)', '--other': '#123' } as BrandOverride);
    expect(target.style.getPropertyValue('--primary')).toBe('#006be6');
    expect(target.style.getPropertyValue('--other')).toBe('');
    runtime.dispose();
  });
  it('restores its prior DOM state, preserves later external writes and has no effect after disposal', () => {
    const target = document.createElement('div'), m = media();
    target.dataset.theme = 'existing'; target.dataset.density = 'existing'; target.className = 'external';
    target.style.setProperty('--primary', '#abc', 'important');
    target.style.setProperty('--row-height', '77px');
    const runtime = create(target, m);
    runtime.apply(snapshot('system', 'compact'));
    target.style.setProperty('--foreground', '#123');
    target.dataset.density = 'external';
    runtime.dispose(); runtime.dispose();
    expect(target.dataset.theme).toBe('existing');
    expect(target.dataset.density).toBe('external');
    expect(target.className).toBe('external');
    expect(target.style.getPropertyValue('--primary')).toBe('#abc');
    expect(target.style.getPropertyPriority('--primary')).toBe('important');
    expect(target.style.getPropertyValue('--foreground')).toBe('#123');
    expect(target.style.getPropertyValue('--row-height')).toBe('77px');
    const after = target.outerHTML;
    runtime.apply(snapshot('dark')); runtime.setBrand({ '--primary': '#456' }); m.change(true);
    expect(target.outerHTML).toBe(after);
    expect(m.listeners.size).toBe(0);
  });
  it('keeps target lifetimes isolated and permits setup after cleanup', () => {
    const a = document.createElement('div'), b = document.createElement('div'), m = media();
    const first = create(a, m), second = create(b, m);
    first.apply(snapshot('system')); second.apply(snapshot('system', 'compact'));
    first.setBrand({ '--primary': '#123456' });
    expect(m.listeners.size).toBe(2);
    first.dispose();
    expect(m.listeners.size).toBe(1);
    expect(b.dataset).toMatchObject({ theme: 'light', density: 'compact' });
    expect(b.style.getPropertyValue('--primary')).toBe('#006be6');
    const replay = create(a, m); replay.apply(snapshot('system')); m.change(true);
    expect(a.dataset.theme).toBe('dark');
    expect(b.dataset).toMatchObject({ theme: 'dark', density: 'compact' });
    second.dispose(); replay.dispose();
    expect(m.listeners.size).toBe(0);
  });
  it('uses the snapshot guards and recovers to CSS-compatible light when media is unavailable', () => {
    const target = document.createElement('div');
    const runtime = hooks.createThemeRuntime({ target, matchMedia: () => { throw Error('blocked'); } });
    runtime.apply({ schemaVersion: 99, mode: 'dark', density: 'compact' } as unknown as ThemeSnapshot);
    expect(target.dataset).toMatchObject({ theme: 'light', density: 'standard' });
    runtime.apply(snapshot('dark', 'compact'));
    expect(target.dataset).toMatchObject({ theme: 'dark', density: 'compact' });
    runtime.dispose();
  });
});

it('uses the same V2 presentation for classic and runtime including region rings and filters', async () => {
  const { defaultThemeAppearance, resolvePresentationTheme } = await import('@niubu/core-design');
  const { applyThemeSnapshot } = await import('./theme-dom.ts');
  const target = document.createElement('div'), m = media();
  const input = { schemaVersion: 2 as const, mode: 'light' as const, density: 'compact' as const, appearance: { ...defaultThemeAppearance, mode: 'light' as const, preset: 'violet' as const, radius: .75 as const, fontSize: 20, semiDarkSidebar: true, colorWeak: true, grayscale: true } };
  applyThemeSnapshot(target, input, false);
  const classic = target.outerHTML;
  const runtime = create(target, m); runtime.apply(input);
  expect(target.outerHTML).toBe(classic);
  expect(target.dataset).toMatchObject({ themePreset: 'violet', semiDarkSidebar: 'true', grayscale: 'true', colorWeak: 'true' });
  expect(target.style.getPropertyValue('--radius')).toBe('0.75rem');
  expect(target.style.getPropertyValue('--font-size-base')).toBe('20px');
  expect(target.style.getPropertyValue('--presentation-filter')).toBe('grayscale(1) invert(1)');
  expect(target.style.getPropertyValue('--sidebar-ring')).toBe(resolvePresentationTheme(input.appearance, 'light')['--sidebar-ring']);
  runtime.dispose();
  expect(target.outerHTML).toBe(classic);
});
it('replaces an existing owner on the same target without leaking system listeners', () => {
  const target = document.createElement('div'), m = media();
  const first = create(target, m); first.apply(snapshot('system'));
  const second = create(target, m); second.apply(snapshot('system', 'compact'));
  expect(m.listeners.size).toBe(1);
  const current = target.outerHTML;
  first.apply(snapshot('dark')); first.dispose();
  expect(target.outerHTML).toBe(current);
  m.change(true); expect(target.dataset.theme).toBe('dark');
  second.dispose(); expect(m.listeners.size).toBe(0);
});
it('restores owned presentation fields while preserving later external region writes and priorities', async () => {
  const { defaultThemeAppearance } = await import('@niubu/core-design');
  const target = document.createElement('div'), m = media();
  target.style.setProperty('--radius', '9px', 'important');
  target.dataset.themePreset = 'prior';
  const runtime = create(target, m);
  runtime.apply({ schemaVersion: 2, mode: 'light', density: 'standard', appearance: { ...defaultThemeAppearance, grayscale: true, semiDarkHeader: true } });
  target.style.setProperty('--header-ring', '#123456', 'important');
  target.dataset.colorWeak = 'external';
  runtime.dispose();
  expect(target.style.getPropertyValue('--radius')).toBe('9px');
  expect(target.style.getPropertyPriority('--radius')).toBe('important');
  expect(target.style.getPropertyValue('--header-ring')).toBe('#123456');
  expect(target.style.getPropertyPriority('--header-ring')).toBe('important');
  expect(target.style.getPropertyValue('--presentation-filter')).toBe('');
  expect(target.dataset.themePreset).toBe('prior');
  expect(target.dataset.colorWeak).toBe('external');
});

it('keeps all fifteen palettes identical between synchronous cold presentation and runtime for forced/system modes', async () => {
  const { applyThemeSnapshot } = await import('./theme-dom.ts');
  for (const preset of themePresets) for (const mode of ['light', 'dark', 'system'] as const) for (const systemDark of [false, true]) {
    const appearance = { ...defaultThemeAppearance, mode, preset: preset.id, semiDarkSidebar: true, semiDarkSubmenu: true, semiDarkHeader: true };
    const input = { schemaVersion: 2 as const, mode, density: 'compact' as const, appearance };
    const cold = document.createElement('div'), live = document.createElement('div'), m = media();
    m.change(systemDark);
    applyThemeSnapshot(cold, input, systemDark);
    const runtime = create(live, m); runtime.apply(input);
    expect(live.outerHTML, `${preset.id}/${mode}/${systemDark}`).toBe(cold.outerHTML);
    expect(m.listeners.size).toBe(mode === 'system' ? 1 : 0);
    runtime.dispose(); expect(m.listeners.size).toBe(0);
  }
});
