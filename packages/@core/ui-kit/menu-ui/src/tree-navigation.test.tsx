import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TreeNavigation, type NavigationNode } from './TreeNavigation';
const nodes: readonly NavigationNode[] = [{ kind: 'branch', id: 'domain', label: 'Domain', children: [
  { kind: 'leaf', id: 'a', label: 'Alpha', href: '/alpha?scopeId=b', active: true },
  { kind: 'leaf', id: 'b', label: 'Beta', href: '/beta', active: false },
] }];
it('keeps expansion controlled and forwards only projected hrefs with current metadata', () => {
  const expand = vi.fn(), navigate = vi.fn();
  const props = { nodes, label: 'Projected tree', expandedIds: [] as string[], renderLink: (p: import('./index').LinkProps) => <a {...p} onClick={event => { event.preventDefault(); p.onClick?.(); }} />, onExpand: expand, onNavigate: navigate };
  const { rerender } = render(<TreeNavigation {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Domain' }));
  expect(expand).toHaveBeenCalledWith('domain', true);
  expect(screen.queryByRole('link', { name: 'Alpha' })).toBeNull();
  rerender(<TreeNavigation {...props} expandedIds={['domain']} />);
  const link = screen.getByRole('link', { name: 'Alpha' });
  expect(link).toHaveAttribute('href', '/alpha?scopeId=b');
  expect(link).toHaveAttribute('aria-current', 'page');
  fireEvent.click(link);
  expect(navigate).toHaveBeenCalledOnce();
});
it('supports keyboard sibling ordering and ignores a cross-parent drop', () => {
  const reorder = vi.fn();
  render(<TreeNavigation nodes={nodes} label="Tree" expandedIds={['domain']} renderLink={p => <a {...p} />} onExpand={() => {}} onReorder={reorder} />);
  fireEvent.keyDown(screen.getByRole('link', { name: 'Beta' }), { key: 'ArrowUp', altKey: true });
  expect(reorder).toHaveBeenCalledWith('domain', ['b', 'a']);
  fireEvent.drop(screen.getByRole('link', { name: 'Alpha' }).closest('li')!, { dataTransfer: { getData: () => 'domain' } });
  expect(reorder).toHaveBeenCalledTimes(1);
});
it('preserves a nested leaf drag source through the full bubbling event before same-parent drop', () => {
  const reorder = vi.fn();
  const grouped: NavigationNode[] = [{ kind: 'branch', presentation: 'group', id: 'group', label: 'Group', children: nodes }];
  render(<TreeNavigation nodes={grouped} label="Nested" expandedIds={['domain']} renderLink={p => <a {...p} />} onExpand={() => {}} onReorder={reorder} />);
  const values = new Map<string, string>();
  const dataTransfer = { setData: (key: string, value: string) => values.set(key, value), getData: (key: string) => values.get(key) ?? '' };
  fireEvent.dragStart(screen.getByRole('link', { name: 'Beta' }).closest('li')!, { dataTransfer });
  expect(dataTransfer.getData('text/niubu-navigation')).toBe('b');
  fireEvent.drop(screen.getByRole('link', { name: 'Alpha' }).closest('li')!, { dataTransfer });
  expect(reorder).toHaveBeenCalledExactlyOnceWith('domain', ['b', 'a']);
});
it('closes the containing horizontal group on Escape or outside intent, returns keyboard focus and cleans the outside listener', () => {
  const expand = vi.fn();
  const grouped: NavigationNode[] = [{ kind: 'branch', id: 'group', label: 'Group', children: nodes }];
  const { unmount } = render(<TreeNavigation nodes={grouped} label="Header tree" orientation="horizontal" expandedIds={['group', 'domain']} renderLink={p => <a {...p} />} onExpand={expand} />);
  const group = screen.getByRole('button', { name: 'Group' }); const leaf = screen.getByRole('link', { name: 'Alpha' });
  leaf.focus(); fireEvent.keyDown(leaf, { key: 'Escape' });
  expect(expand).toHaveBeenLastCalledWith('group', false); expect(group).toHaveFocus();
  expand.mockClear(); fireEvent.pointerDown(document.body); expect(expand).toHaveBeenCalledExactlyOnceWith('group', false);
  expand.mockClear(); unmount(); fireEvent.pointerDown(document.body); expect(expand).not.toHaveBeenCalled();
});
it('uses its visible disclosure name without shadowing a real form label with a redundant aria-label', async () => {
  const { existsSync, readFileSync } = await import('node:fs'); const { dirname, join } = await import('node:path');
  let root = process.cwd(); while (!existsSync(join(root, 'pnpm-workspace.yaml')) && dirname(root) !== root) root = dirname(root);
  const css = readFileSync(join(root, 'packages/@core/ui-kit/menu-ui/src/styles.css'), 'utf8');
  const { container } = render(<><style>{css}</style><label htmlFor="equipment">Equipment</label><select id="equipment"><option>Asset A</option></select><TreeNavigation nodes={[{ kind: 'branch', id: 'equipment-domain', label: 'Equipment', children: [] }]} label="Business navigation" expandedIds={[]} renderLink={p => <a {...p} />} onExpand={() => {}} compact /></>);
  expect(screen.getByLabelText('Equipment', { exact: true })).toBe(screen.getByRole('combobox'));
  expect(screen.getByRole('button', { name: 'Equipment' })).toHaveAccessibleName('Equipment');
  const label = container.querySelector('.navigation-label')!;
  expect(getComputedStyle(label).display).not.toBe('none'); expect(getComputedStyle(label).visibility).not.toBe('hidden');
  expect(getComputedStyle(label).position).toBe('absolute'); expect(getComputedStyle(label).clipPath).toBe('inset(50%)');
});
