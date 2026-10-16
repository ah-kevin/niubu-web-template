import { expect, it } from 'vitest';
import { corePreferenceDefaults, type CorePreferences, type LayoutMode } from '@niubu/core-preferences';
import { resolveBusinessLayout } from './layout-model';
const modes: LayoutMode[] = ['vertical', 'two-column', 'horizontal', 'sidebar', 'mixed-vertical', 'mixed-two-column', 'full-content'];
const prefs = (mode: LayoutMode = 'vertical'): CorePreferences => ({ ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode } });
it('gives all seven modes different navigation regions or header placement using canonical dimensions', () => {
  const models = modes.map(mode => resolveBusinessLayout(prefs(mode), 'desktop'));
  expect(new Set(models.map(m => JSON.stringify([m.headerEnabled, m.headerPlacement, m.sidebarEnabled, m.secondarySidebarEnabled, m.topNavigationEnabled, m.primaryKind]))).size).toBe(7);
  for (const m of models) expect([m.headerHeight, m.tabbarHeight, m.sidebarWidth, m.collapsedWidth, m.railWidth, m.footerHeight]).toEqual([50, 38, 224, 60, 80, 32]);
});
it('keeps a collapsed layout footprint while hover expands temporarily without changing preferences', () => {
  const p = prefs(); p.sidebar = { ...p.sidebar, collapsed: true };
  expect(resolveBusinessLayout(p, 'desktop').primarySpace).toBe(60);
  expect(resolveBusinessLayout(p, 'desktop', { hovered: true })).toMatchObject({ primarySpace: 60, primaryWidth: 224 });
  expect(p.sidebar.collapsed).toBe(true);
  const two = resolveBusinessLayout({ ...p, layout: { ...p.layout, mode: 'two-column' } }, 'desktop');
  expect(two.primarySpace).toBe(80); expect(two.secondarySpace).toBe(60);
});
it('converges all modes to a mobile drawer and preserves a recovery surface even with chrome disabled', () => {
  for (const mode of modes) {
    const m = resolveBusinessLayout(prefs(mode), 'mobile');
    expect([m.sidebarEnabled, m.secondarySidebarEnabled, m.topNavigationEnabled]).toEqual([false, false, false]);
    expect(m.primarySpace + m.secondarySpace).toBe(0);
  }
  const p = prefs(); p.header = { ...p.header, enabled: false }; p.sidebar = { ...p.sidebar, enabled: false };
  expect(resolveBusinessLayout(p, 'desktop')).toMatchObject({ recoveryRequired: true, primarySpace: 0, tabbarOffset: 0 });
  expect(resolveBusinessLayout(prefs(), 'desktop', { contentMaximized: true })).toMatchObject({ recoveryRequired: true, sidebarEnabled: false, headerEnabled: false });
});
it('consumes width/padding/footer/header modes without changing the document scroll host', () => {
  const p = prefs('sidebar'); p.layout = { ...p.layout, contentMode: 'fixed', fixedWidth: 1000, contentPadding: 24 }; p.footer = { enabled: true, fixed: true };
  expect(resolveBusinessLayout(p, 'desktop')).toMatchObject({ contentMode: 'fixed', fixedWidth: 1000, contentPadding: 24, footerEnabled: true, footerFixed: true, sidebarOffset: 50, scrollHost: 'document' });
  p.header = { ...p.header, mode: 'static' };
  expect(resolveBusinessLayout(p, 'desktop')).toMatchObject({ headerFixed: false, tabbarFixed: false, sidebarOffset: 0 });
  p.header = { ...p.header, mode: 'auto' };
  expect(resolveBusinessLayout(p, 'desktop', { scrollHidden: true })).toMatchObject({ headerHidden: true, tabbarHidden: false, tabbarOffset: 0 });
  p.header.mode = 'auto-scroll';
  expect(resolveBusinessLayout(p, 'desktop', { scrollHidden: true }).tabbarHidden).toBe(true);
});

it('exposes the normalized session maximization contract separately from full-content layout preference', () => {
  expect(resolveBusinessLayout(prefs(), 'desktop').contentMaximized).toBe(false);
  expect(resolveBusinessLayout(prefs(), 'desktop', { contentMaximized: false }).contentMaximized).toBe(false);
  expect(resolveBusinessLayout(prefs(), 'desktop', { contentMaximized: true })).toMatchObject({ contentMaximized: true, headerEnabled: false, sidebarEnabled: false, recoveryRequired: true });
  expect(resolveBusinessLayout(prefs(), 'mobile', { contentMaximized: true }).contentMaximized).toBe(true);
  expect(resolveBusinessLayout(prefs('full-content'), 'desktop').contentMaximized).toBe(false);
});

it('expands manually without hover while retaining the collapsed footprint', () => {
  const preferences = { ...corePreferenceDefaults, sidebar: { ...corePreferenceDefaults.sidebar, collapsed: true, expandOnHover: false } };
  const model = resolveBusinessLayout(preferences, 'desktop', { sidebarExpanded: true });
  expect(model.primarySpace).toBe(60);
  expect(model.primaryWidth).toBe(224);
  expect(model.sidebarVisuallyCollapsed).toBe(false);
});
