import { createPortal } from 'react-dom';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { corePreferenceDefaults } from '@niubu/core-preferences';
import type { LinkRenderer, NavigationNode } from '@niubu/menu-ui';
import { BusinessLayout } from './BusinessLayout';
import { resolveBusinessLayout } from './layout-model';
const nodes: NavigationNode[] = [{ kind: 'branch', id: 'sales', label: 'Sales', children: [{ kind: 'leaf', id: 'orders', label: 'Orders', href: '/orders?scopeKind=workspace&scopeId=B', active: true }] }];
const labels = { skipContent: 'Skip', sidebar: 'Sidebar', navigation: 'Navigation', mobileNavigation: 'Mobile', openNavigation: 'Open', workspaceNavigation: 'Description', pageContext: 'Context', recovery: 'Layout recovery', restoreLayout: 'Restore layout', collapse: 'Collapse', expand: 'Expand', pin: 'Pin', unpin: 'Unpin', resize: 'Resize sidebar', secondaryNavigation: 'Submenu', topNavigation: 'Top navigation' };
const props = () => ({ brand: 'Brand', density: 'standard' as const, model: resolveBusinessLayout(corePreferenceDefaults, 'desktop'), labels, navigation: nodes, primaryNodes: nodes, expandedIds: ['sales'], renderLink: ((p) => <a {...p} onClick={event => { event.preventDefault(); p.onClick?.(); }} />) satisfies LinkRenderer, onExpand: vi.fn(), mobileOpen: false, onMobileOpenChange: vi.fn(), children: <h1>Body</h1>, onRestoreLayout: vi.fn() });
it('renders real chrome slots, independent themed navigation panes and one document-owned main', () => {
  const p = props();
  const { container, rerender } = render(<BusinessLayout {...p} breadcrumbs={<nav aria-label="Breadcrumbs">Context</nav>} mode={<span>Read-only</span>} />);
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  expect(screen.getByRole('link', { name: 'Skip' })).toHaveAttribute('href', '#main-content');
  expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
  expect(container.querySelector('[data-slot="page-tabs"]')).toHaveStyle({ height: '38px' });
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(screen.getByRole('region', { name: 'Context' })).toHaveTextContent('Read-only');
  expect(container.querySelector('[data-scroll-host="document"]')).toBeTruthy();
  const model = resolveBusinessLayout({ ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode: 'two-column' } }, 'desktop');
  rerender(<BusinessLayout {...p} model={model} secondaryNodes={nodes} selectedPrimaryId="sales" />);
  expect(container.querySelector('[data-theme-region="sidebar"]')).toBeTruthy();
  expect(container.querySelector('[data-theme-region="submenu"]')).not.toHaveClass('desktop-sidebar');
  expect(within(screen.getByRole('complementary', { name: 'Submenu' })).getByRole('link', { name: 'Orders' })).toBeVisible();
});
it('keeps a real restoration and navigation entry when all normal chrome is hidden', () => {
  const p = props();
  render(<BusinessLayout {...p} model={resolveBusinessLayout({ ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode: 'full-content' } }, 'desktop')} />);
  expect(screen.queryByRole('banner')).toBeNull();
  const recovery = screen.getByRole('region', { name: 'Layout recovery' });
  fireEvent.click(within(recovery).getByRole('button', { name: 'Restore layout' }));
  expect(p.onRestoreLayout).toHaveBeenCalledOnce();
  fireEvent.click(within(recovery).getByRole('button', { name: 'Open' }));
  expect(p.onMobileOpenChange).toHaveBeenCalledWith(true);
});
it('supports controlled mobile tree navigation and returns focus to the actual trigger', async () => {
  const p = props();
  const { rerender } = render(<BusinessLayout {...p} model={resolveBusinessLayout(corePreferenceDefaults, 'mobile')} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(p.onMobileOpenChange).toHaveBeenCalledWith(true);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<BusinessLayout {...p} model={resolveBusinessLayout(corePreferenceDefaults, 'mobile')} mobileOpen />);
  const dialog = await screen.findByRole('dialog', { name: 'Brand' });
  expect(dialog).toHaveAttribute('data-theme-region', 'sidebar');
  fireEvent.click(within(dialog).getByRole('link', { name: 'Orders' }));
  expect(p.onMobileOpenChange).toHaveBeenCalledWith(false);
});
it('offers keyboard resize within product bounds without a storage or router dependency', () => {
  const p = props(); const change = vi.fn();
  render(<BusinessLayout {...p} sidebarControls={{ width: 224, collapsed: false, fixed: true, draggable: true, showCollapse: true, showFixed: true, onWidthChange: change, onCollapsedChange: vi.fn(), onFixedChange: vi.fn() }} />);
  const separator = screen.getByRole('separator', { name: 'Resize sidebar' });
  expect(separator).toHaveAttribute('aria-valuemin', '160');
  expect(separator).toHaveAttribute('aria-valuemax', '320');
  fireEvent.keyDown(separator, { key: 'ArrowRight' }); expect(change).toHaveBeenLastCalledWith(232);
  fireEvent.keyDown(separator, { key: 'Home' }); expect(change).toHaveBeenLastCalledWith(160);
  fireEvent.keyDown(separator, { key: 'End' }); expect(change).toHaveBeenLastCalledWith(320);
});
it.each([
  ['vertical', true, false, false, 'content', '224px', '0px'],
  ['two-column', true, true, false, 'content', '80px', '224px'],
  ['horizontal', false, false, true, 'full', '0px', '0px'],
  ['sidebar', true, false, false, 'full', '224px', '0px'],
  ['mixed-vertical', true, false, true, 'full', '224px', '0px'],
  ['mixed-two-column', true, true, true, 'full', '80px', '224px'],
  ['full-content', false, false, false, 'full', '0px', '0px'],
] as const)('maps %s to real regions and CSS grid footprints', (mode, primary, secondary, top, placement, firstWidth, secondWidth) => {
  const p = props();
  const { container } = render(<BusinessLayout {...p} model={resolveBusinessLayout({ ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode } }, 'desktop')} topNodes={nodes} secondaryNodes={nodes} />);
  expect(!!container.querySelector('.layout-primary-pane')).toBe(primary);
  expect(!!container.querySelector('.layout-secondary-pane')).toBe(secondary);
  expect(!!container.querySelector('.layout-top-navigation')).toBe(top);
  expect(container.querySelector('.foundation-layout')).toHaveAttribute('data-header-placement', placement);
  expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--layout-primary-space')).toBe(firstWidth);
  expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--layout-secondary-space')).toBe(secondWidth);
});
it('passes customized dimensions to the actual renderer, and removes hidden headers from focus navigation', () => {
  const p = props();
  const model = resolveBusinessLayout({ ...corePreferenceDefaults, sidebar: { ...corePreferenceDefaults.sidebar, width: 320 }, layout: { ...corePreferenceDefaults.layout, contentMode: 'fixed', fixedWidth: 2400, contentPadding: 64 }, header: { ...corePreferenceDefaults.header, mode: 'auto' } }, 'desktop', { scrollHidden: true });
  const { container } = render(<BusinessLayout {...p} model={model} topActions={<button>Settings</button>} />);
  const root = container.firstElementChild as HTMLElement;
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('320px');
  expect(root.style.getPropertyValue('--layout-content-width')).toBe('2400px');
  expect(root.style.getPropertyValue('--layout-content-padding')).toBe('64px');
  expect(root.style.getPropertyValue('--layout-tab-offset')).toBe('0px');
  expect(container.querySelector('header')).toHaveAttribute('inert');
  expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
});
it.each(['vertical', 'mixed-vertical', 'mixed-two-column'] as const)('provides a CSS-visible desktop drawer entry in %s when the remaining selectors cannot reach leaves', async mode => {
  let root = process.cwd();
  while (!existsSync(join(root, 'pnpm-workspace.yaml')) && dirname(root) !== root) root = dirname(root);
  const css = readFileSync(join(root, 'packages/@core/ui-kit/layout-ui/src/styles.css'), 'utf8');
  const p = props(); const preferences = { ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode }, sidebar: { ...corePreferenceDefaults.sidebar, enabled: false } };
  const model = resolveBusinessLayout(preferences, 'desktop');
  const { container, rerender } = render(<><style>{css}</style><BusinessLayout {...p} model={model} topNodes={nodes} /></>);
  expect(model.recoveryRequired).toBe(true);
  expect(container.querySelector('.layout-primary-pane,.layout-secondary-pane')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Orders' })).toBeNull();
  const opener = screen.getByRole('button', { name: 'Open' });
  expect(getComputedStyle(opener).display).not.toBe('none');
  fireEvent.click(opener); expect(p.onMobileOpenChange).toHaveBeenCalledWith(true);
  rerender(<><style>{css}</style><BusinessLayout {...p} model={model} topNodes={nodes} mobileOpen /></>);
  const dialog = await screen.findByRole('dialog', { name: 'Brand' });
  expect(within(dialog).getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/orders?scopeKind=workspace&scopeId=B');
});
it('applies the existing sidebar theme consumer to the actual portal without tinting the main', async () => {
  let root = process.cwd();
  while (!existsSync(join(root, 'pnpm-workspace.yaml')) && dirname(root) !== root) root = dirname(root);
  const base = readFileSync(join(root, 'packages/styles/src/base.css'), 'utf8');
  const rule = base.slice(base.indexOf('.desktop-sidebar,'), base.indexOf("\n[data-theme-region='submenu']"));
  const p = props();
  render(<><style>{rule}</style><BusinessLayout {...p} mobileOpen model={resolveBusinessLayout(corePreferenceDefaults, 'mobile')} /></>);
  const dialog = await screen.findByRole('dialog', { name: 'Brand' });
  expect(dialog.parentElement?.closest('.business-shell')).toBeNull();
  expect(getComputedStyle(dialog).getPropertyValue('--background').trim()).toBe('var(--sidebar-background)');
  expect(screen.getByRole('main', { hidden: true })).not.toHaveAttribute('data-theme-region');
});
it('keeps the real action owner and content mounted across layout/recovery changes', () => {
  const p = props();
  const { rerender } = render(<BusinessLayout {...p} topActions={<input aria-label="Tool session" defaultValue="retain" />} />);
  const tool = screen.getByRole('textbox', { name: 'Tool session' }); const main = screen.getByRole('main');
  fireEvent.change(tool, { target: { value: 'open preference input' } });
  rerender(<BusinessLayout {...p} model={resolveBusinessLayout({ ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode: 'full-content' } }, 'desktop')} topActions={<input aria-label="Tool session" defaultValue="retain" />} />);
  expect(screen.getByRole('textbox', { name: 'Tool session' })).toBe(tool); expect(tool).toHaveValue('open preference input'); expect(screen.getByRole('main')).toBe(main);
});
it.each(['start','center','end'] as const)('aligns actual top navigation to %s without moving the main scroll owner',align=>{
 const p=props();const model=resolveBusinessLayout({...corePreferenceDefaults,layout:{...corePreferenceDefaults.layout,mode:'horizontal'}},'desktop');const {container}=render(<BusinessLayout {...p} model={model} headerMenuAlign={align} topNodes={nodes}/>);expect(container.querySelector('.layout-top-navigation')).toHaveStyle({justifyContent:align});expect(container.querySelector('[data-scroll-host="document"]')).not.toBeNull();expect(screen.getAllByRole('main')).toHaveLength(1);
});

it('requests desktop collapse without opening the mobile Sheet', () => {
  const p = props(); const onCollapsedChange = vi.fn();
  render(<BusinessLayout {...p} sidebarControls={{ width: 224, collapsed: false, fixed: true, draggable: false, showCollapse: true, showFixed: false, onWidthChange: vi.fn(), onCollapsedChange, onFixedChange: vi.fn() }} />);
  fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Collapse' }));
  expect(onCollapsedChange).toHaveBeenCalledWith(true);
  expect(p.onMobileOpenChange).not.toHaveBeenCalled();
});

it.each([false, true])('respects hidden collapse controls when collapsed=%s without disabling mobile or recovery navigation', collapsed => {
  const p = props();
  const preferences = { ...corePreferenceDefaults, sidebar: { ...corePreferenceDefaults.sidebar, collapsed } };
  const controls = { width: 224, collapsed, fixed: true, draggable: false, showCollapse: false, showFixed: false, onWidthChange: vi.fn(), onCollapsedChange: vi.fn(), onFixedChange: vi.fn() };
  const { container, rerender } = render(<BusinessLayout {...p} model={resolveBusinessLayout(preferences, 'desktop')} sidebarControls={controls} />);
  expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
  expect(container.querySelector('.desktop-nav-trigger')).toBeNull();
  expect(controls.onCollapsedChange).not.toHaveBeenCalled();
  rerender(<BusinessLayout {...p} model={resolveBusinessLayout(preferences, 'mobile')} sidebarControls={controls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(p.onMobileOpenChange).toHaveBeenCalledWith(true);
  p.onMobileOpenChange.mockClear();
  rerender(<BusinessLayout {...p} model={resolveBusinessLayout({ ...preferences, layout: { ...preferences.layout, mode: 'full-content' } }, 'desktop')} sidebarControls={controls} />);
  fireEvent.click(within(screen.getByRole('region', { name: 'Layout recovery' })).getByRole('button', { name: 'Open' }));
  expect(p.onMobileOpenChange).toHaveBeenCalledWith(true);
});

it('provides live mobile header and recovery tool slots while preserving document content', () => {
  const p = props();
  const tools = ({ headerAvailable, headerTarget }: { headerAvailable: boolean; headerTarget: HTMLDivElement | null }) =>
    headerAvailable && headerTarget ? createPortal(<button>Docked tools</button>, headerTarget) : <button>Fallback tools</button>;
  const { rerender } = render(<BusinessLayout {...p} model={resolveBusinessLayout(corePreferenceDefaults, 'mobile')} foundationTools={tools} />);
  const main = screen.getByRole('main');
  expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Docked tools' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Fallback tools' })).toBeNull();
  rerender(<BusinessLayout {...p} model={resolveBusinessLayout({ ...corePreferenceDefaults, header: { ...corePreferenceDefaults.header, enabled: false } }, 'mobile')} foundationTools={tools} />);
  expect(within(screen.getByRole('region', { name: 'Layout recovery' })).getByRole('button', { name: 'Docked tools' })).toBeInTheDocument();
  expect(screen.getByRole('main')).toBe(main);
  rerender(<BusinessLayout {...p} model={resolveBusinessLayout({ ...corePreferenceDefaults, header: { ...corePreferenceDefaults.header, mode: 'auto' } }, 'desktop', { scrollHidden: true })} foundationTools={tools} />);
  expect(screen.queryByRole('button', { name: 'Docked tools' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Fallback tools' })).toBeInTheDocument();
});

it('follows Vben sidebar configuration for icons independently of desktop collapse and drawer visibility', () => {
  const p = props();
  const controls = { width: 224, collapsed: false, fixed: true, draggable: false, showCollapse: true, showFixed: false, onWidthChange: vi.fn(), onCollapsedChange: vi.fn(), onFixedChange: vi.fn() };
  const { rerender } = render(<BusinessLayout {...p} sidebarControls={controls} />);
  expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Collapse' }).querySelector('svg')).toHaveAttribute('data-icon', 'ep:fold');
  fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Collapse' }));
  expect(controls.onCollapsedChange).toHaveBeenCalledWith(true);
  rerender(<BusinessLayout {...p} sidebarControls={{ ...controls, collapsed: true }} />);
  expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Expand' }).querySelector('svg')).toHaveAttribute('data-icon', 'ep:fold');
  const disabled = { ...corePreferenceDefaults, sidebar: { ...corePreferenceDefaults.sidebar, enabled: false } };
  const horizontal = { ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode: 'horizontal' as const } };
  const full = { ...corePreferenceDefaults, layout: { ...corePreferenceDefaults.layout, mode: 'full-content' as const } };
  for (const [preferences, icon] of [[corePreferenceDefaults, 'ep:fold'], [disabled, 'ep:expand'], [horizontal, 'ep:expand'], [full, 'ep:expand']] as const) {
    for (const viewport of ['desktop', 'mobile'] as const) {
      const model = resolveBusinessLayout(preferences, viewport);
      rerender(<BusinessLayout {...p} model={model} />);
      expect(screen.getByRole('button', { name: 'Open' }).querySelector('svg')).toHaveAttribute('data-icon', icon);
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      expect(p.onMobileOpenChange).toHaveBeenLastCalledWith(true);
      rerender(<BusinessLayout {...p} model={model} mobileOpen />);
      expect(screen.getByRole('button', { name: 'Open', hidden: true }).querySelector('svg')).toHaveAttribute('data-icon', icon);
    }
  }
});
