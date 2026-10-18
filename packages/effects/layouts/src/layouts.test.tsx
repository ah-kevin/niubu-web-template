import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { useSchemaForm } from '@niubu/common-ui/form';
import { afterEach, expect, it, vi } from 'vitest';
import { PreferenceProvider, createPreferenceManager } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks';
import { createI18n } from '@niubu/locales';
import { I18nProvider } from '@niubu/locales/react';
import { StoresProvider } from '@niubu/stores/react';
import { createAppStores } from '@niubu/stores';
import { BusinessShell } from './BusinessShell';
const dispose: Array<() => void> = [];
afterEach(() => dispose.splice(0).reverse().forEach(fn => fn()));
async function mount(children?: ReactNode) {
  const stores = createAppStores({ identityKey: 'isolated', readContext: null });
  const manager = createPreferenceManager({ identity: { product: 'niubu', storageNamespace: 'niubu', appId: 'x', environment: 'test', identityKey: 'x' }, storage: createStoragePort({ getItem: () => null, setItem: () => {} }) });
  const i18n = createI18n({ defaultLocale: 'en-US', appLoaders: {} }); await i18n.changeLocale('en-US', i18n.requiredNamespaces);
  const onNavigateTo = vi.fn();
  const shell = (navigationKey: string, contentMaximized = false) => <StoresProvider stores={stores}><PreferenceProvider manager={manager}><I18nProvider instance={i18n}><BusinessShell brand="Independent" contentMaximized={contentMaximized} onRestoreContent={() => stores.tabs.setMaximized(false)} navigationKey={navigationKey} navigation={[{ kind: 'branch', id: 'group', label: 'Input group', presentation: 'group', children: [{ kind: 'branch', id: 'domain', label: 'Domain', children: [{ kind: 'leaf', id: 'one', href: '/one?scopeId=b', label: 'Only input', active: true }] }] }]} renderLink={p => <a {...p} onClick={event => { event.preventDefault(); onNavigateTo(p.href); p.onClick?.(); }} />} logo={<strong>Logo slot</strong>} onNavigateTo={onNavigateTo}><h1>Page slot</h1>{children}</BusinessShell></I18nProvider></PreferenceProvider></StoresProvider>;
  const view = render(shell('one'));
  dispose.push(() => { view.unmount(); stores.dispose(); manager.dispose(); i18n.dispose(); });
  return { ...view, stores, manager, onNavigateTo, maximize: () => { stores.tabs.setMaximized(true); view.rerender(shell('one', true)); }, changeKey: (key: string) => view.rerender(shell(key)) };
}
it('binds labels, preferences, active ancestor expansion and memory UI without app policy', async () => {
  const { stores, manager } = await mount(); const main = screen.getByRole('main');
  expect(within(main).getByRole('heading', { name: 'Page slot' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Only input' })).toHaveAttribute('href', '/one?scopeId=b');
  act(() => { manager.update({ density: 'compact', sidebar: { collapsed: true } }); });
  expect(main.closest('.business-shell')).toHaveAttribute('data-layout-density', 'compact'); expect(main.closest('.business-shell')).toHaveAttribute('data-sidebar-collapsed', 'true');
  const pane = screen.getByRole('complementary', { name: 'Workspace navigation' });
  fireEvent.mouseEnter(pane); expect((main.closest('.business-shell') as HTMLElement).style.getPropertyValue('--layout-primary-width')).toBe('224px');
  expect(manager.getSnapshot().core.sidebar.collapsed).toBe(true);
  fireEvent.mouseLeave(pane); expect((main.closest('.business-shell') as HTMLElement).style.getPropertyValue('--layout-primary-width')).toBe('60px');
  act(() => stores.ui.update({ mobileOpen: true })); expect(await screen.findByRole('dialog', { name: 'Independent' })).toBeVisible();
});
it('restores hidden chrome through a real preference update and consumes split navigation without permission decisions', async () => {
  const { manager, onNavigateTo } = await mount();
  act(() => manager.update({ layout: { mode: 'two-column' }, sidebar: { autoActivateChild: true } }));
  fireEvent.click(screen.getByRole('button', { name: 'Domain' })); expect(onNavigateTo).toHaveBeenCalledWith('/one?scopeId=b');
  act(() => manager.update({ layout: { mode: 'full-content' }, header: { enabled: false }, sidebar: { enabled: false } }));
  expect(screen.queryByRole('complementary')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Restore layout' }));
  expect(manager.getSnapshot().core).toMatchObject({ layout: { mode: 'vertical' }, header: { enabled: true }, sidebar: { enabled: true } });
});
it('keeps horizontal groups as real disclosures with canonical ancestry, Escape close and focus return', async () => {
  const { manager } = await mount();
  act(() => manager.update({ layout: { mode: 'horizontal' } }));
  const nav = screen.getByRole('navigation', { name: 'Top navigation' });
  expect(within(nav).queryByRole('button', { name: 'Domain' })).toBeNull();
  const group = within(nav).getByRole('button', { name: 'Input group' });
  expect(group).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(group);
  const domain = within(nav).getByRole('button', { name: 'Domain' });
  const leaf = within(nav).getByRole('link', { name: 'Only input' });
  expect(domain.closest('li')!.parentElement!.closest('li')).toBe(group.closest('li'));
  expect(leaf).toHaveAttribute('href', '/one?scopeId=b');
  leaf.focus(); fireEvent.keyDown(leaf, { key: 'Escape' });
  expect(group).toHaveAttribute('aria-expanded', 'false'); expect(group).toHaveFocus();
  expect(within(nav).queryByRole('link', { name: 'Only input' })).toBeNull();
});
it('expands while either pointer or keyboard remains in either sidebar pane, without persisting the transient expansion', async () => {
  const { manager } = await mount();
  act(() => manager.update({ sidebar: { collapsed: true } }));
  const root = screen.getByRole('main').closest('.business-shell') as HTMLElement;
  const primary = screen.getByRole('complementary', { name: 'Workspace navigation' });
  act(() => screen.getByRole('button', { name: 'Domain' }).focus());
  act(() => screen.getByRole('link', { name: 'Only input' }).focus());
  fireEvent.mouseEnter(primary); fireEvent.mouseLeave(primary);
  expect(primary.contains(document.activeElement)).toBe(true);
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('224px');
  act(() => screen.getByRole('main').focus());
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('60px');
  act(() => manager.update({ layout: { mode: 'two-column' } }));
  const secondary = screen.getByRole('complementary', { name: 'Secondary navigation' });
  act(() => screen.getByRole('button', { name: 'Domain' }).focus());
  fireEvent.mouseEnter(secondary); fireEvent.mouseLeave(primary);
  act(() => screen.getByRole('main').focus());
  expect(root.style.getPropertyValue('--layout-secondary-width')).toBe('224px');
  fireEvent.mouseLeave(secondary); expect(root.style.getPropertyValue('--layout-secondary-width')).toBe('60px');
  expect(manager.getSnapshot().core.sidebar.collapsed).toBe(true);
});

it('clears only transient expansion on route and geometry changes while retaining the persisted collapsed preference', async () => {
  const { manager, changeKey } = await mount(); act(() => manager.update({ sidebar: { collapsed: true } }));
  const root = screen.getByRole('main').closest('.business-shell') as HTMLElement;
  const pane = screen.getByRole('complementary', { name: 'Workspace navigation' });
  fireEvent.mouseEnter(pane); expect(root.style.getPropertyValue('--layout-primary-width')).toBe('224px');
  changeKey('next'); expect(root.style.getPropertyValue('--layout-primary-width')).toBe('60px');
  fireEvent.mouseEnter(pane); act(() => manager.update({ layout: { mode: 'sidebar' } }));
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('60px'); expect(manager.getSnapshot().core.sidebar.collapsed).toBe(true);
});

it('restores only session maximization without changing any persisted preference', async () => {
  const { manager, stores, maximize } = await mount();
  act(() => manager.update({ layout: { mode: 'two-column' }, header: { mode: 'static' }, sidebar: { width: 280 } }));
  const before = manager.getSnapshot();
  act(maximize);
  fireEvent.click(screen.getByRole('button', { name: 'Restore layout' }));
  expect(stores.tabs.getSnapshot().contentMaximized).toBe(false);
  expect(manager.getSnapshot()).toBe(before);
});

it('keeps manual expansion until committed navigation or Escape', async () => {
  const { manager, changeKey, onNavigateTo, stores } = await mount();
  const user = userEvent.setup();
  act(() => manager.update({ sidebar: { collapsed: true, expandOnHover: false } }));
  const root = screen.getByRole('main').closest('.business-shell') as HTMLElement;
  const branch = screen.getByRole('button', { name: 'Domain' });
  await user.click(branch);
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('224px');
  expect(root).toHaveAttribute('data-sidebar-visually-collapsed', 'false');
  expect(stores.ui.getSnapshot().mobileOpen).toBe(false);
  const leaf = screen.getByRole('link', { name: 'Only input' });
  fireEvent.click(leaf); // The injected navigation request is cancelled: navigationKey never commits.
  expect(onNavigateTo).toHaveBeenCalledWith('/one?scopeId=b');
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('224px');
  changeKey('committed');
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('60px');
  const sameBranch = screen.getByRole('button', { name: 'Domain' });
  act(() => sameBranch.focus());
  await user.keyboard('{Enter}');
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('224px');
  await user.keyboard('{Escape}');
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('60px');
  expect(sameBranch).toHaveFocus();
  expect(manager.getSnapshot().core.sidebar.collapsed).toBe(true);
  expect(onNavigateTo).toHaveBeenCalledTimes(1);
});

it('returns Escape focus to the current branch after Tab hover expansion', async () => {
  const { manager } = await mount();
  const user = userEvent.setup();
  act(() => manager.update({ sidebar: { collapsed: true, expandOnHover: true } }));
  const root = screen.getByRole('main').closest('.business-shell') as HTMLElement;
  const branch = screen.getByRole('button', { name: 'Domain' });
  await user.tab(); // Skip link.
  await user.tab(); // The actual branch triggers focus expansion without click/Enter.
  expect(branch).toHaveFocus();
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('224px');
  await user.tab();
  const leaf = screen.getByRole('link', { name: 'Only input' });
  expect(leaf).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(root.style.getPropertyValue('--layout-primary-width')).toBe('60px');
  expect(leaf.isConnected).toBe(false);
  expect(branch).toHaveFocus();
  expect(manager.getSnapshot().core.sidebar.collapsed).toBe(true);
});


it.each(['auto', 'auto-scroll'] as const)('keeps the first invalid field visible when upward reveal restores %s chrome', async mode => {
  function Editor() {
    const api = useSchemaForm<{ source: string }>({
      fields: [{ name: 'source', label: 'Source', kind: 'text', required: true }],
      defaultValues: { source: '' },
    });
    return <api.Form submitLabel="Check source" />;
  }
  const root = document.documentElement;
  const descriptors = [
    [window, 'scrollY'], [window, 'innerHeight'], [window, 'innerWidth'], [root, 'scrollTop'],
  ].map(([target, key]) => ({ target: target as object, key: key as string, descriptor: Object.getOwnPropertyDescriptor(target, key as string) }));
  let scroll = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scroll });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  Object.defineProperty(root, 'scrollTop', { configurable: true, get: () => scroll, set: (next: number) => {
    scroll = next;
    window.dispatchEvent(new Event('scroll'));
  } });
  const spies: Array<{ mockRestore(): void }> = [];
  try {
    const { manager } = await mount(<Editor />);
    act(() => manager.update({ header: { mode } }));
    const shell = screen.getByRole('main').closest('.business-shell')!;
    const input = screen.getByRole('textbox', { name: 'Source' });
    const field = input.closest<HTMLElement>('.schema-field')!;
    spies.push(vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() => new DOMRect(16, 126 - scroll, 343, 32)));
    spies.push(vi.spyOn(field, 'getBoundingClientRect').mockImplementation(() => new DOMRect(16, 100 - scroll, 343, 90)));
    act(() => { root.scrollTop = 364.5; }); // The actual BusinessShell listener hides chrome on downward scroll.
    expect(shell).toHaveAttribute('data-header-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Check source' }));
    await waitFor(() => expect(input).toHaveFocus());
    expect(shell).toHaveAttribute('data-header-hidden', 'false'); // Upward error reveal makes the header visible again.
    expect(field.getBoundingClientRect().top).toBeGreaterThanOrEqual(88);
    expect(field.getBoundingClientRect().bottom).toBeLessThanOrEqual(812);
  } finally {
    spies.forEach(spy => spy.mockRestore());
    for (const { target, key, descriptor } of descriptors) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  }
});
