import { defaultThemeAppearance, foundationDimensions } from '@niubu/core-design';
import type { CorePreferences, LayoutMode, WidgetId } from './types.ts';
/** Fixed source: Vben v5.7.0 preference layout picker; internal keys are the public contract. */
export const vbenLayoutSourceKeys = Object.freeze({
  vertical: 'sidebar-nav',
  'two-column': 'sidebar-mixed-nav',
  horizontal: 'header-nav',
  sidebar: 'header-sidebar-nav',
  'mixed-vertical': 'mixed-nav',
  'mixed-two-column': 'header-mixed-nav',
  'full-content': 'full-content',
} satisfies Record<LayoutMode, string>);
export const widgetIds: readonly WidgetId[] = Object.freeze([
  'search',
  'preferences',
  'theme',
  'language',
  'timezone',
  'fullscreen',
  'refresh',
  'notification',
]);
export const preferenceLimits = Object.freeze({
  sidebarWidth: [160, 320],
  fixedWidth: [800, 2400],
  contentPadding: [0, 64],
  maxCount: [0, 100],
} as const);
export const corePreferenceDefaults = Object.freeze({
  locale: 'zh-CN',
  theme: defaultThemeAppearance,
  density: 'standard',
  layout: Object.freeze({ mode: 'vertical', contentMode: 'fluid', fixedWidth: 1200, contentPadding: 0 }),
  sidebar: Object.freeze({
    collapsed: false,
    enabled: true,
    width: foundationDimensions.sidebarWidth,
    fixed: true,
    draggable: true,
    expandOnHover: true,
    collapsedShowTitle: false,
    autoActivateChild: false,
    showCollapseButton: true,
    showFixedButton: true,
  }),
  header: Object.freeze({ enabled: true, mode: 'fixed', menuAlign: 'start' }),
  menu: Object.freeze({ style: 'rounded', split: true, accordion: true }),
  breadcrumb: Object.freeze({ enabled: true, hideOnlyOne: false, showIcon: true, showHome: false, style: 'normal' }),
  tabbar: Object.freeze({
    enabled: true,
    persist: true,
    visitHistory: true,
    maxCount: 0,
    draggable: true,
    wheelable: true,
    middleClickClose: false,
    showIcon: true,
    showMore: true,
    showMaximize: true,
    showRefresh: true,
    style: 'chrome',
  }),
  widget: Object.freeze(
    Object.fromEntries(
      widgetIds.map(id => [id, Object.freeze({ enabled: true, position: 'auto' })]),
    ) as CorePreferences['widget'],
  ),
  footer: Object.freeze({ enabled: false, fixed: false }),
  copyright: Object.freeze({
    enabled: true,
    companyName: '',
    companyUrl: '',
    year: '2026',
    icpNumber: '',
    icpUrl: '',
  }),
  shortcut: Object.freeze({ enabled: true, globalSearch: true, globalPreferences: true, globalEscape: true }),
  general: Object.freeze({
    dynamicTitle: true,
    displayTimeZone: 'Asia/Shanghai',
    watermark: false,
    watermarkText: '',
    copyPreferences: true,
  }),
  transition: Object.freeze({ progress: true, loading: true, enabled: true, style: 'fade-slide' }),
}) satisfies CorePreferences;
