import { validateThemeAppearancePatch } from '@niubu/core-design';
import { preferenceLimits, vbenLayoutSourceKeys, widgetIds } from './defaults.ts';
import type { CorePreferences, DeepPartial, Density, Locale, ThemeMode } from './types.ts';
export const isLocale = (input: unknown): input is Locale => input === 'zh-CN' || input === 'en-US';
export const isThemeMode = (input: unknown): input is ThemeMode =>
  input === 'light' || input === 'dark' || input === 'system';
export const isDensity = (input: unknown): input is Density => input === 'standard' || input === 'compact';
export const isPreferenceRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input);
const own = (input: Record<string, unknown>, key: string): unknown =>
  Object.hasOwn(input, key) ? input[key] : undefined;
type Guard = (value: unknown) => boolean;
const boolean: Guard = value => typeof value === 'boolean';
const oneOf =
  (...values: readonly string[]): Guard =>
  value =>
    typeof value === 'string' && values.includes(value);
const integer =
  (limits: readonly [number, number]): Guard =>
  value =>
    typeof value === 'number' && Number.isInteger(value) && value >= limits[0] && value <= limits[1];
const text =
  (max: number): Guard =>
  value =>
    typeof value === 'string' &&
    value.length <= max &&
    ![...value].some(c => c.codePointAt(0)! < 32 || c.codePointAt(0) === 127);
const webUrl: Guard = value => {
  if (value === '') return true;
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};
const timeZone: Guard = value => {
  if (typeof value !== 'string' || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
};
const fields = {
  layout: {
    mode: oneOf(...Object.keys(vbenLayoutSourceKeys)),
    contentMode: oneOf('fluid', 'fixed'),
    fixedWidth: integer(preferenceLimits.fixedWidth),
    contentPadding: integer(preferenceLimits.contentPadding),
  },
  sidebar: {
    collapsed: boolean,
    enabled: boolean,
    width: integer(preferenceLimits.sidebarWidth),
    fixed: boolean,
    draggable: boolean,
    expandOnHover: boolean,
    collapsedShowTitle: boolean,
    autoActivateChild: boolean,
    showCollapseButton: boolean,
    showFixedButton: boolean,
  },
  header: {
    enabled: boolean,
    mode: oneOf('auto', 'auto-scroll', 'fixed', 'static'),
    menuAlign: oneOf('start', 'center', 'end'),
  },
  menu: { style: oneOf('plain', 'rounded'), split: boolean, accordion: boolean },
  breadcrumb: {
    enabled: boolean,
    hideOnlyOne: boolean,
    showIcon: boolean,
    showHome: boolean,
    style: oneOf('normal', 'background'),
  },
  tabbar: {
    enabled: boolean,
    persist: boolean,
    visitHistory: boolean,
    maxCount: integer(preferenceLimits.maxCount),
    draggable: boolean,
    wheelable: boolean,
    middleClickClose: boolean,
    showIcon: boolean,
    showMore: boolean,
    showMaximize: boolean,
    showRefresh: boolean,
    style: oneOf('brisk', 'card', 'chrome', 'plain'),
  },
  footer: { enabled: boolean, fixed: boolean },
  copyright: {
    enabled: boolean,
    companyName: text(80),
    companyUrl: webUrl,
    year: (value: unknown) => typeof value === 'string' && /^\d{4}(?:-\d{4})?$/.test(value),
    icpNumber: text(80),
    icpUrl: webUrl,
  },
  shortcut: { enabled: boolean, globalSearch: boolean, globalPreferences: boolean, globalEscape: boolean },
  general: {
    dynamicTitle: boolean,
    displayTimeZone: timeZone,
    watermark: boolean,
    watermarkText: text(120),
    copyPreferences: boolean,
  },
  transition: {
    progress: boolean,
    loading: boolean,
    enabled: boolean,
    style: oneOf('fade', 'fade-down', 'fade-slide', 'fade-up'),
  },
} satisfies Record<string, Record<string, Guard>>;
function filterFields(input: unknown, guards: Record<string, Guard>): Record<string, unknown> {
  if (!isPreferenceRecord(input)) return {};
  return Object.fromEntries(
    Object.entries(guards).flatMap(([key, guard]) => {
      const value = own(input, key);
      return guard(value) ? [[key, value]] : [];
    }),
  );
}
/** Only own whitelisted display fields are accepted; ignored fields preserve earlier valid intent. */
export function validateCorePreferencePatch(input: unknown): DeepPartial<CorePreferences> {
  if (!isPreferenceRecord(input)) return {};
  const patch: Record<string, unknown> = {},
    locale = own(input, 'locale'),
    density = own(input, 'density');
  if (isLocale(locale)) patch.locale = locale;
  if (isDensity(density)) patch.density = density;
  const theme = validateThemeAppearancePatch(own(input, 'theme'));
  if (Object.keys(theme).length) patch.theme = theme;
  for (const [name, guards] of Object.entries(fields)) {
    const value = filterFields(own(input, name), guards);
    if (Object.keys(value).length) patch[name] = value;
  }
  const widget = own(input, 'widget');
  if (isPreferenceRecord(widget)) {
    const values: Record<string, unknown> = {};
    for (const id of widgetIds) {
      const value = filterFields(own(widget, id), {
        enabled: boolean,
        position: oneOf('auto', 'fixed', 'header', 'user-dropdown'),
      });
      if (Object.keys(value).length) values[id] = value;
    }
    if (Object.keys(values).length) patch.widget = values;
  }
  return patch as DeepPartial<CorePreferences>;
}
