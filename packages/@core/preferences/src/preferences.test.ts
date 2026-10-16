import { describe, expect, it } from 'vitest';
import { defaultThemeAppearance } from '@niubu/core-design';
import { corePreferenceDefaults as defaults } from './defaults.ts';
import { resolvePreferences, resetPreferences, mergeValidatedPreference, parseThemeSnapshot } from './index.ts';
describe('pure preferences', () => {
  it('resolves defaults, app, validated persisted, then policy without mutation', () => {
    const appDefaults = { locale: 'en-US', theme: { mode: 'dark' }, density: 'compact' } as const;
    expect(
      resolvePreferences({
        appDefaults,
        persisted: { locale: 'zh-CN', density: 'standard', sidebar: { collapsed: true } },
        policy: { density: 'compact' },
      }),
    ).toEqual({ ...defaults, locale: 'zh-CN', theme: { ...defaults.theme, mode: 'dark' }, density: 'compact', sidebar: { ...defaults.sidebar, collapsed: true } });
    expect(appDefaults.theme.mode).toBe('dark');
    expect(resolvePreferences()).toEqual(defaults);
    expect(defaults.theme.mode).toBe('system');
    expect(defaults.density).toBe('standard');
    expect(defaults.locale).toBe('zh-CN');
    expect(defaults.sidebar.collapsed).toBe(false);
  });
  it.each(['zh-CN', 'en-US'] as const)('drops bad persisted fields without replacing valid %s app defaults', locale => {
    expect(
      resolvePreferences({
        appDefaults: { locale, density: 'compact', theme: { mode: 'dark' }, sidebar: { collapsed: true } },
        persisted: {
          locale: 'fr-FR',
          density: 'dense',
          theme: { mode: 'bad' },
          sidebar: { collapsed: 'false' },
          credentials: 'never',
        },
      }),
    ).toEqual({ ...defaults, locale, density: 'compact', theme: { ...defaults.theme, mode: 'dark' }, sidebar: { ...defaults.sidebar, collapsed: true } });
  });
  it.each([null, [], 'broken', 42, { theme: null, sidebar: [] }].map(value => [value]))(
    'ignores malformed persisted root %j',
    persisted => {
      expect(resolvePreferences({ persisted })).toEqual(resolvePreferences());
    },
  );
  it('reset ignores persisted and uses effective app plus policy defaults', () => {
    const options = {
      appDefaults: { density: 'compact', theme: { mode: 'dark' } },
      policy: { theme: { mode: 'light' } },
      persisted: { density: 'standard', sidebar: { collapsed: true } },
    } as const;
    expect(resetPreferences(options)).toEqual({ ...defaults, locale: 'zh-CN', density: 'compact', theme: { ...defaults.theme, mode: 'light' }, sidebar: { ...defaults.sidebar, collapsed: false } });
  });
  it('replaces and deeply clones extension arrays and preserves nested siblings', () => {
    const base = { columns: [{ id: 'name' }, { id: 'age' }], nested: { a: 1, b: 2 } };
    const patch = { columns: [{ id: 'id' }], nested: { a: 3 } };
    const result = mergeValidatedPreference(base, patch);
    expect(result).toEqual({ columns: [{ id: 'id' }], nested: { a: 3, b: 2 } });
    result.columns[0]!.id = 'changed';
    result.nested.b = 4;
    expect(patch.columns[0]!.id).toBe('id');
    expect(base.nested.b).toBe(2);
    expect(mergeValidatedPreference(base, { columns: [] }).columns).toEqual([]);
  });
  it('ignores undefined patches and unsafe object keys', () => {
    const result = mergeValidatedPreference(
      { safe: { value: 1 } },
      JSON.parse('{"__proto__":{"polluted":true},"safe":{"constructor":{"bad":true}}}'),
    );
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result).toEqual({ safe: { value: 1 } });
    expect(mergeValidatedPreference({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });
  it('rejects unknown snapshot versions as a whole and invalid v1 fields separately', () => {
    expect(parseThemeSnapshot({ schemaVersion: 99, mode: 'dark', density: 'compact' })).toEqual({
      schemaVersion: 2,
      appearance: { ...defaultThemeAppearance, mode: 'system' },
      mode: 'system',
      density: 'standard',
    });
    expect(parseThemeSnapshot({ schemaVersion: 1, mode: 'dark', density: 'wrong', locale: 'en-US' })).toEqual({
      schemaVersion: 2,
      appearance: { ...defaultThemeAppearance, mode: 'dark' },
      mode: 'dark',
      density: 'standard',
    });
    expect(parseThemeSnapshot({ schemaVersion: 1, mode: 'wrong', density: 'compact' })).toEqual({
      schemaVersion: 2,
      appearance: { ...defaultThemeAppearance, mode: 'system' },
      mode: 'system',
      density: 'compact',
    });
    expect(parseThemeSnapshot(null)).toEqual({ schemaVersion: 2, mode: 'system', density: 'standard', appearance: defaultThemeAppearance });
  });
});

it('exposes complete display namespaces, preserving old intent and rejecting invalid additions', () => {
  const core = resolvePreferences({ persisted: { theme: { mode: 'light', preset: 'sakura', fontSize: 20 }, density: 'compact', locale: 'en-US', layout: { mode: 'two-column' }, sidebar: { width: 288 } } });
  expect(core.theme).toMatchObject({ mode: 'light', preset: 'sakura', fontSize: 20, colorPrimary: '#006be6', radius: .5 });
  expect(core).toMatchObject({ locale: 'en-US', density: 'compact', layout: { mode: 'two-column', contentMode: 'fluid', fixedWidth: 1200, contentPadding: 0 }, sidebar: { width: 288 }, header: { mode: 'fixed' }, tabbar: { maxCount: 0, style: 'chrome' }, general: { displayTimeZone: 'Asia/Shanghai' } });
  expect(Object.keys(resolvePreferences()).sort()).toEqual(['breadcrumb', 'copyright', 'density', 'footer', 'general', 'header', 'layout', 'locale', 'menu', 'shortcut', 'sidebar', 'tabbar', 'theme', 'transition', 'widget']);
  const invalid = resolvePreferences({ persisted: { theme: { colorPrimary: 'var(--evil)', radius: NaN, fontSize: 23 }, sidebar: { width: Infinity }, layout: { fixedWidth: 799 }, header: { mode: 'sticky' }, tabbar: { maxCount: -1 }, copyright: { companyUrl: 'javascript:evil()' }, general: { displayTimeZone: 'No/Zone' } } });
  expect(invalid).toEqual(resolvePreferences());
});
it('upgrades v1 snapshots while accepting only synchronous V2 presentation, with top-level mode authoritative', () => {
  const result = parseThemeSnapshot({ schemaVersion: 2, mode: 'light', density: 'compact', appearance: { mode: 'dark', preset: 'violet', fontSize: 22, colorWeak: true, unsafe: 'url(x)' }, locale: 'en-US', drafts: [] });
  expect(result).toMatchObject({ schemaVersion: 2, mode: 'light', density: 'compact', appearance: { mode: 'light', preset: 'violet', fontSize: 22, colorWeak: true } });
  expect(Object.keys(result)).toEqual(['schemaVersion', 'mode', 'density', 'appearance']);
  expect(result).not.toHaveProperty('appearance.unsafe');
});

it('core defaults carry no product display name', () => {
  const preferences = resolvePreferences();
  expect(preferences.copyright.companyName).toBe('');
  expect(preferences.general.watermarkText).toBe('');
});
