import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { NavigationNode } from '@niubu/menu-ui';
import { corePreferenceDefaults } from '@niubu/core-preferences';
import { BusinessLayout, type LayoutLabels } from './BusinessLayout';
import { resolveBusinessLayout } from './layout-model';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
let workspace = process.cwd();
while (!existsSync(join(workspace, 'pnpm-workspace.yaml')) && dirname(workspace) !== workspace) workspace = dirname(workspace);
const css = readFileSync(join(workspace, 'packages/@core/ui-kit/layout-ui/src/styles.css'), 'utf8');
const labels: LayoutLabels = { skipContent: 'Skip', sidebar: 'Sidebar', navigation: 'Navigation', mobileNavigation: 'Mobile', openNavigation: 'Open', workspaceNavigation: 'Workspace', pageContext: 'Context', recovery: 'Recovery', restoreLayout: 'Restore', collapse: 'Collapse', expand: 'Expand', pin: 'Pin', unpin: 'Unpin', resize: 'Resize', secondaryNavigation: 'Secondary', topNavigation: 'Top' };
it('makes the canonical header and footer actual aligned rows while keeping document-owned main and independently scrolling panes', () => {
  const prefs = { ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode: 'two-column' as const }, footer: { enabled: true, fixed: true } };
  const { container } = render(<><style>{css}</style><BusinessLayout brand="Brand" density="standard" labels={labels} model={resolveBusinessLayout(prefs, 'desktop')} navigation={[]} expandedIds={[]} onExpand={vi.fn()} renderLink={p => <a {...p} />} mobileOpen={false} onMobileOpenChange={vi.fn()} onRestoreLayout={vi.fn()} topActions={<button>Settings</button>} footer={<><span>Company</span><span>Facts</span></>}><h1>Body</h1></BusinessLayout></>);
  const header = screen.getByRole('banner'); const footer = screen.getByRole('contentinfo'); const main = screen.getByRole('main');
  expect(getComputedStyle(header).display).toBe('flex');
  expect(getComputedStyle(header).alignItems).toBe('center');
  expect(getComputedStyle(footer).display).toBe('flex');
  expect(getComputedStyle(footer).alignItems).toBe('center');
  expect(getComputedStyle(main).flexGrow).toBe('1');
  for (const pane of container.querySelectorAll('.layout-navigation-scroll')) {
    expect(getComputedStyle(pane).overflowY).toBe('auto'); expect(parseFloat(getComputedStyle(pane).minHeight)).toBe(0);
  }
  expect(container.querySelectorAll('.layout-navigation-scroll')).toHaveLength(2);
  for (const page of [main, main.parentElement!]) expect(['auto', 'scroll', 'hidden']).not.toContain(getComputedStyle(page).overflowY);
});
it('applies the actual submenu region consumer to nested navigation without leaking into main', async () => {
  const { readFileSync, existsSync } = await import('node:fs'); const { dirname, join } = await import('node:path');
  let root = process.cwd(); while (!existsSync(join(root, 'pnpm-workspace.yaml')) && dirname(root) !== root) root = dirname(root);
  const base = readFileSync(join(root, 'packages/styles/src/base.css'), 'utf8');
  const regions = base.slice(base.indexOf('.desktop-sidebar,'), base.indexOf("\n.workspace-header,"));
  const menuCss = readFileSync(join(root, 'packages/@core/ui-kit/menu-ui/src/styles.css'), 'utf8');
  const { container } = render(<><style>{regions + menuCss + css}</style><BusinessLayout brand="Brand" density="standard" labels={labels} model={resolveBusinessLayout(corePreferenceDefaults, 'desktop')} navigation={[{ kind: 'branch', id: 'domain', label: 'Domain', children: [{ kind: 'leaf', id: 'leaf', label: 'Leaf', href: '/legal', active: true }] }]} expandedIds={['domain']} onExpand={vi.fn()} renderLink={p => <a {...p} />} mobileOpen={false} onMobileOpenChange={vi.fn()} onRestoreLayout={vi.fn()}><h1>Body</h1></BusinessLayout></>);
  const submenu = container.querySelector('.navigation-children[data-theme-region="submenu"]'); expect(submenu).not.toBeNull();
  expect(getComputedStyle(submenu!).getPropertyValue('--background').trim()).toBe('var(--sidebar-submenu-background)');
  const rules = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules]);
  const painted = rules.find(rule => 'selectorText' in rule && (rule as CSSStyleRule).selectorText === ".tree-navigation .navigation-children[data-theme-region='submenu']") as CSSStyleRule;
  expect(painted.style.getPropertyValue('background')).toBe('var(--sidebar-submenu)');
  expect(screen.getByRole('main').closest('[data-theme-region]')).toBeNull();
});

it('opens the four horizontal group popups without clipping their nested domain disclosures and closes them with keyboard or outside intent', () => {
  const menuCss = readFileSync(join(workspace, 'packages/@core/ui-kit/menu-ui/src/styles.css'), 'utf8');
  const nodes: NavigationNode[] = Array.from({ length: 4 }, (_, i) => ({ kind: 'branch', id: `group:${i}`, label: `Group ${i}`, children: [{ kind: 'branch', id: `domain:${i}`, label: `Domain ${i}`, children: [{ kind: 'leaf', id: `leaf:${i}`, label: `Leaf ${i}`, href: `/legal-${i}?scopeId=b`, active: i === 0 }] }] }));
  function Fixture() {
    const [expandedIds, update] = useState<readonly string[]>([]);
    return <BusinessLayout brand="Brand" density="standard" labels={labels} model={resolveBusinessLayout({ ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode: 'horizontal' } }, 'desktop')} navigation={nodes} topNodes={nodes} expandedIds={expandedIds} onExpand={(id, open) => update(ids => open ? [...ids, id] : ids.filter(item => item !== id))} renderLink={p => <a {...p} />} mobileOpen={false} onMobileOpenChange={vi.fn()} onRestoreLayout={vi.fn()}><h1>Body</h1></BusinessLayout>;
  }
  render(<><style>{menuCss + css}</style><Fixture /></>);
  const nav = screen.getByRole('navigation', { name: 'Top' }); expect(within(nav).getAllByRole('button')).toHaveLength(4);
  const group = within(nav).getByRole('button', { name: 'Group 0' }); fireEvent.click(group);
  const popup = document.getElementById(group.getAttribute('aria-controls')!)!;
  expect(getComputedStyle(popup).position).toBe('absolute');
  const domain = within(nav).getByRole('button', { name: 'Domain 0' }); fireEvent.click(domain);
  const nested = document.getElementById(domain.getAttribute('aria-controls')!)!;
  expect(getComputedStyle(nested).position).not.toBe('absolute');
  for (const ancestor of [nav, nav.parentElement!, nav.parentElement!.parentElement!]) expect(['auto', 'scroll', 'hidden', 'clip']).not.toContain(getComputedStyle(ancestor).overflowY);
  const leaf = within(nav).getByRole('link', { name: 'Leaf 0' }); leaf.focus(); fireEvent.keyDown(leaf, { key: 'Escape' });
  expect(group).toHaveFocus(); expect(group).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(group); fireEvent.pointerDown(screen.getByRole('main'));
  expect(group).toHaveAttribute('aria-expanded', 'false');
});
it.each(['fixed', 'auto', 'auto-scroll'] as const)('gives %s a viewport-fixed header and an explicit canonical grid placeholder while static stays in flow', mode => {
  const preferences = { ...corePreferenceDefaults, header: { ...corePreferenceDefaults.header, mode } };
  const props = { brand: 'Brand', density: 'standard' as const, labels, navigation: [], expandedIds: [], onExpand: vi.fn(), renderLink: (p: import('@niubu/menu-ui').LinkProps) => <a {...p} />, mobileOpen: false, onMobileOpenChange: vi.fn(), onRestoreLayout: vi.fn(), children: <h1>Body</h1> };
  const { container, rerender } = render(<><style>{css}</style><BusinessLayout {...props} model={resolveBusinessLayout(preferences, 'desktop')} /></>);
  const header = screen.getByRole('banner'); const root = container.querySelector('.foundation-layout')!;
  expect(getComputedStyle(header).position).toBe('fixed');
  expect(getComputedStyle(header).left).toBe('calc(var(--layout-primary-space) + var(--layout-secondary-space))');
  expect(getComputedStyle(header).right).toBe('0px');
  expect(getComputedStyle(root).gridTemplateRows).toContain('minmax(var(--layout-header-space), auto)');
  expect((root as HTMLElement).style.getPropertyValue('--layout-header-space')).toBe('50px');
  rerender(<><style>{css}</style><BusinessLayout {...props} model={resolveBusinessLayout({ ...preferences, layout: { ...preferences.layout, mode: 'sidebar' } }, 'desktop')} /></>);
  expect(getComputedStyle(screen.getByRole('banner')).left).toBe('0px');
  rerender(<><style>{css}</style><BusinessLayout {...props} model={resolveBusinessLayout({ ...preferences, header: { ...preferences.header, mode: 'static' } }, 'desktop')} /></>);
  expect(getComputedStyle(screen.getByRole('banner')).position).toBe('relative');
});
