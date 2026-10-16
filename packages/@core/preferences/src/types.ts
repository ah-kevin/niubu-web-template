import type { ThemeAppearance } from '@niubu/core-design';
export type { ThemeAppearance, ThemePresetId } from '@niubu/core-design';
export type Locale = 'zh-CN' | 'en-US';
export type ThemeMode = ThemeAppearance['mode'];
export type Density = 'standard' | 'compact';
export type LayoutMode =
  'vertical' | 'two-column' | 'horizontal' | 'sidebar' | 'mixed-vertical' | 'mixed-two-column' | 'full-content';
export type WidgetId =
  'search' | 'preferences' | 'theme' | 'language' | 'timezone' | 'fullscreen' | 'refresh' | 'notification';
export type WidgetPosition = 'auto' | 'fixed' | 'header' | 'user-dropdown';
export interface CorePreferences {
  locale: Locale;
  theme: ThemeAppearance;
  density: Density;
  layout: { mode: LayoutMode; contentMode: 'fluid' | 'fixed'; fixedWidth: number; contentPadding: number };
  sidebar: {
    collapsed: boolean;
    enabled: boolean;
    width: number;
    fixed: boolean;
    draggable: boolean;
    expandOnHover: boolean;
    collapsedShowTitle: boolean;
    autoActivateChild: boolean;
    showCollapseButton: boolean;
    showFixedButton: boolean;
  };
  header: {
    enabled: boolean;
    mode: 'auto' | 'auto-scroll' | 'fixed' | 'static';
    menuAlign: 'start' | 'center' | 'end';
  };
  menu: { style: 'plain' | 'rounded'; split: boolean; accordion: boolean };
  breadcrumb: {
    enabled: boolean;
    hideOnlyOne: boolean;
    showIcon: boolean;
    showHome: boolean;
    style: 'normal' | 'background';
  };
  tabbar: {
    enabled: boolean;
    persist: boolean;
    visitHistory: boolean;
    maxCount: number;
    draggable: boolean;
    wheelable: boolean;
    middleClickClose: boolean;
    showIcon: boolean;
    showMore: boolean;
    showMaximize: boolean;
    showRefresh: boolean;
    style: 'brisk' | 'card' | 'chrome' | 'plain';
  };
  widget: Record<WidgetId, { enabled: boolean; position: WidgetPosition }>;
  footer: { enabled: boolean; fixed: boolean };
  copyright: {
    enabled: boolean;
    companyName: string;
    companyUrl: string;
    year: string;
    icpNumber: string;
    icpUrl: string;
  };
  shortcut: { enabled: boolean; globalSearch: boolean; globalPreferences: boolean; globalEscape: boolean };
  general: {
    dynamicTitle: boolean;
    displayTimeZone: string;
    watermark: boolean;
    watermarkText: string;
    copyPreferences: boolean;
  };
  transition: {
    progress: boolean;
    loading: boolean;
    enabled: boolean;
    style: 'fade' | 'fade-down' | 'fade-slide' | 'fade-up';
  };
}
/** Arrays are replacement values, not patches by index. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
export interface PreferenceExtension<T> {
  namespace: string;
  version: number;
  defaults: T;
  validate: (input: unknown) => T;
  migrate: (input: unknown, fromVersion: number) => T;
}
export interface ThemeSnapshotV1 {
  schemaVersion: 1;
  mode: ThemeMode;
  density: Density;
}
export interface ThemeSnapshotV2 {
  schemaVersion: 2;
  mode: ThemeMode;
  density: Density;
  appearance: ThemeAppearance;
}
export type ThemeSnapshot = ThemeSnapshotV1 | ThemeSnapshotV2;
export interface ResolvePreferencesOptions {
  appDefaults?: DeepPartial<CorePreferences>;
  persisted?: unknown;
  policy?: DeepPartial<CorePreferences>;
}
