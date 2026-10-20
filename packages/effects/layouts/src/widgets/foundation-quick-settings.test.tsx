import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { FoundationTools } from './FoundationTools';
import { makeManager, renderWidgets } from './widget-test-utils';

const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }));
afterAll(() => {
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

async function mount() {
  const manager = makeManager();
  manager.update({ widget: { timezone: { enabled: true } } });
  return renderWidgets(<FoundationTools sessionKey="one" headerAvailable={false} headerTarget={null}
    search={{ locale: 'en-US', pages: [], renderLink: props => <a {...props} /> }}
    notifications={{ items: [], renderLink: props => <a {...props} /> }} renderPreferences={() => null} />, manager);
}

async function open(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Workspace tools' }));
  await user.click(await screen.findByRole('menuitem', { name }));
  return screen.findByRole('dialog', { name });
}

it.each([
  ['Choose theme', 'Theme mode'],
  ['Choose language', 'Interface language'],
  ['Display timezone', 'Display timezone'],
])('gives %s a separate popup header and a visible field label', async (name, field) => {
  await mount();
  const dialog = await open(name);
  const heading = within(dialog).getByRole('heading', { name });
  const header = heading.closest('[data-slot="dialog-header"]');
  expect(header).not.toBeNull();
  expect(header).not.toContainElement(within(dialog).getByRole('combobox', { name: field }));
  expect(within(dialog).getByText(field, { selector: 'label' })).toBeVisible();
  await userEvent.setup().keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('button', { name: 'Workspace tools' })).toHaveFocus();
});

it('does not report an earlier save as the result of a newly opened setting', async () => {
  const { manager } = await mount();
  const dialog = await open('Choose theme');
  const user = userEvent.setup();
  const select = within(dialog).getByRole('combobox', { name: 'Theme mode' });
  select.focus();
  await user.keyboard('{ArrowDown}');
  await user.click(await screen.findByRole('option', { name: 'Dark' }));
  expect(manager.getSnapshot().core.theme.mode).toBe('dark');
  expect(within(dialog).getByRole('status')).toBeVisible();
  await user.keyboard('{Escape}');
  const language = await open('Choose language');
  expect(within(language).queryByRole('status')).toBeNull();
  expect(manager.getSnapshot().core.theme.mode).toBe('dark');
});

it('returns to the same visible header tool when its portal host was replaced while open', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  const first = document.createElement('div'), second = document.createElement('div');
  document.body.append(first, second);
  const scene = (headerTarget: HTMLDivElement) => <FoundationTools sessionKey="one" headerAvailable headerTarget={headerTarget}
    search={{ locale: 'en-US', pages: [], renderLink: props => <a {...props} /> }}
    notifications={{ items: [], renderLink: props => <a {...props} /> }} renderPreferences={() => null} />;
  try {
    const view = await renderWidgets(scene(first));
    const original = screen.getByRole('button', { name: 'Choose theme' });
    await userEvent.setup().click(original);
    await screen.findByRole('dialog', { name: 'Choose theme' });
    view.rerender(scene(second));
    const current = second.querySelector('[data-widget-id="theme"]');
    expect(original.isConnected).toBe(false);
    expect(current).not.toBeNull();
    await userEvent.setup().keyboard('{Escape}');
    await waitFor(() => expect(current).toHaveFocus());
  } finally { first.remove(); second.remove(); vi.unstubAllGlobals(); }
});
