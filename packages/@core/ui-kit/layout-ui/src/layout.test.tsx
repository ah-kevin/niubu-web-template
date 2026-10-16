import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BusinessLayout, PublicLayout, AccountLayout } from './index';
import { corePreferenceDefaults } from '@niubu/core-preferences';
import { resolveBusinessLayout } from './layout-model';
const labels = {
  skipContent: 'Skip',
  sidebar: 'Sidebar',
  navigation: 'Navigation',
  mobileNavigation: 'Mobile',
  openNavigation: 'Open',
  workspaceNavigation: 'Description',
  pageContext: 'Context', recovery: 'Recovery', restoreLayout: 'Restore', collapse: 'Collapse', expand: 'Expand', pin: 'Pin', unpin: 'Unpin', resize: 'Resize', secondaryNavigation: 'Secondary', topNavigation: 'Top',
};
it('requests mobile opening while leaving the value controlled by its caller', async () => {
  const change = vi.fn();
  const props = {
    brand: 'Brand',
    density: 'standard' as const,
    model: resolveBusinessLayout(corePreferenceDefaults, 'desktop'),
    expandedIds: [], onExpand() {}, onRestoreLayout() {},
    labels,
    navigation: [],
    renderLink: (p: Parameters<import('@niubu/menu-ui').LinkRenderer>[0]) => <a {...p} />,
    mobileOpen: false,
    onMobileOpenChange: change,
    children: <h1>Body</h1>,
  };
  const { rerender } = render(<BusinessLayout {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(change).toHaveBeenCalledWith(true);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<BusinessLayout {...props} mobileOpen />);
  expect(await screen.findByRole('dialog', { name: 'Brand' })).toBeVisible();
});
it('keeps public and account content in a single focusable main landmark', () => {
  const props = { skipContent: 'Skip', density: 'compact' as const, sidebarCollapsed: false, children: <h1>Body</h1> };
  const { unmount } = render(<PublicLayout {...props} />);
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  unmount();
  render(<AccountLayout {...props} />);
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Skip' })).toHaveAttribute('href', '#main-content');
});
