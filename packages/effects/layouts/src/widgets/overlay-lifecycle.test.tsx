import { lazy, StrictMode } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { widgetIds } from '@niubu/core-preferences';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@niubu/shadcn-ui/dialog';
import { PreferenceProvider } from '@niubu/preferences';
import { FoundationTools } from './FoundationTools';
import { DisplaySettings } from './DisplaySettings';
import type { OverlayContentProps } from './types';
import { deferred, makeManager, renderWidgets } from './widget-test-utils';

function Preferences({ contentId, onClose, returnFocus }: OverlayContentProps) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent id={contentId} onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }}><DialogTitle>Fixture preferences</DialogTitle><DialogDescription>Fixture controls</DialogDescription></DialogContent></Dialog>;
}
const search = { locale: 'en-US', pages: [], renderLink: (props: React.ComponentProps<'a'> & { href: string }) => <a {...props} /> };
const notifications = { items: [], renderLink: search.renderLink };

it('returns focus after closing without asking the browser to scroll the launcher into view', async () => {
  await renderWidgets(<DisplaySettings renderPreferences={props => <Preferences {...props} />} />);
  const trigger = screen.getByRole('button', { name: 'Display preferences' });
  fireEvent.click(trigger);
  await screen.findByRole('dialog');
  const focus = vi.spyOn(trigger, 'focus');
  try {
    await userEvent.setup().keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
  } finally { focus.mockRestore(); }
});

it('uses the main-content fallback when the launcher ancestor becomes hidden before close', async () => {
  await renderWidgets(<><div data-testid="header"><DisplaySettings renderPreferences={props => <Preferences {...props} />} /></div><main id="main-content" tabIndex={-1}>Current page</main></>);
  fireEvent.click(screen.getByRole('button', { name: 'Display preferences' }));
  await screen.findByRole('dialog');
  screen.getByTestId('header').style.display = 'none';
  await userEvent.setup().keyboard('{Escape}');
  await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
});

it('does not steal a newer focus choice while a closed dialog finishes focus cleanup', async () => {
  await renderWidgets(<><DisplaySettings renderPreferences={props => <Preferences {...props} />} /><input aria-label="Next action" /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Display preferences' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  const next = screen.getByRole('textbox', { name: 'Next action' });
  next.focus();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(next).toHaveFocus();
});

it('cancels pending content without letting late resolution reopen or steal focus', async () => {
  const gate = deferred<{ default: typeof Preferences }>();
  const Delayed = lazy(() => gate.promise);
  await renderWidgets(<><DisplaySettings sessionKey="one" renderPreferences={props => <Delayed {...props} />} /><input aria-label="Later focus" /></>);
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: 'Display preferences' });
  await user.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await user.keyboard('{Escape}');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger).toHaveFocus();
  const input = screen.getByRole('textbox', { name: 'Later focus' });
  input.focus();
  await act(async () => { gate.resolve({ default: Preferences }); await gate.promise; });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(input).toHaveFocus();
});

it.each(['session', 'owner'] as const)('retires a pending %s generation while allowing the next generation to open', async change => {
  const gate = deferred<{ default: typeof Preferences }>();
  const Delayed = lazy(() => gate.promise);
  const first = makeManager('first'), second = makeManager('second');
  const scene = (key: string, manager: typeof first) => <PreferenceProvider manager={manager}><DisplaySettings sessionKey={key} renderPreferences={props => <Delayed {...props} />} /><input aria-label="Current focus" /></PreferenceProvider>;
  const view = await renderWidgets(scene('first', first));
  fireEvent.click(screen.getByRole('button', { name: 'Display preferences' }));
  view.rerender(scene(change === 'session' ? 'second' : 'first', change === 'owner' ? second : first));
  const input = screen.getByRole('textbox', { name: 'Current focus' });
  input.focus();
  await act(async () => { gate.resolve({ default: Preferences }); await gate.promise; });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(input).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Display preferences' }));
  expect(await screen.findByRole('dialog', { name: 'Fixture preferences' })).toBeVisible();
});

it('keeps recovery reachable when every launcher and shortcut is disabled', async () => {
  const manager = makeManager();
  manager.update({ widget: Object.fromEntries(widgetIds.map(id => [id, { enabled: false }])), shortcut: { enabled: false } });
  await renderWidgets(<FoundationTools sessionKey="one" search={search} notifications={notifications} renderPreferences={props => <Preferences {...props} />} headerAvailable={false} headerTarget={null} />, manager);
  expect(document.querySelector('[data-widget-id]')).toBeNull();
  const recovery = screen.getByRole('button', { name: 'Recover display preferences' });
  fireEvent.click(recovery);
  expect(await screen.findByRole('dialog', { name: 'Fixture preferences' })).toBeVisible();
  await userEvent.setup().keyboard('{Escape}');
  await waitFor(() => expect(recovery).toHaveFocus());
});

it('does not accumulate shortcut dispatchers in StrictMode or after unmount', async () => {
  const view = await renderWidgets(<StrictMode><DisplaySettings renderPreferences={props => <Preferences {...props} />} /></StrictMode>);
  fireEvent.keyDown(window, { key: ',', ctrlKey: true });
  expect(await screen.findByRole('dialog', { name: 'Fixture preferences' })).toBeVisible();
  await userEvent.setup().keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => { document.body.focus(); });
  fireEvent.keyDown(window, { key: ',', ctrlKey: true });
  expect(await screen.findByRole('dialog', { name: 'Fixture preferences' })).toBeVisible();
  view.unmount();
  fireEvent.keyDown(window, { key: ',', ctrlKey: true });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('keeps the current foundation overlay when a retired search finishes late', async () => {
  const gate = deferred<{ default: typeof Preferences }>();
  const Delayed = lazy(() => gate.promise);
  const config = { ...search, renderDialog: (props: OverlayContentProps) => <Delayed {...props} /> };
  const scene = (sessionKey: string) => <FoundationTools sessionKey={sessionKey} search={config} notifications={notifications} renderPreferences={props => <Preferences {...props} />} headerAvailable={false} headerTarget={null} />;
  const view = await renderWidgets(scene('first'));
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  view.rerender(scene('second'));
  fireEvent.keyDown(window, { key: ',', ctrlKey: true });
  const current = await screen.findByRole('dialog', { name: 'Fixture preferences' });
  const active = document.activeElement;
  await act(async () => { gate.resolve({ default: Preferences }); await gate.promise; });
  expect(screen.getAllByRole('dialog')).toEqual([current]);
  expect(document.activeElement).toBe(active);
});

it('updates shortcut policy when its preference owner changes without leaving old listeners', async () => {
  const first = makeManager('first'), second = makeManager('second');
  second.update({ shortcut: { enabled: false } });
  const scene = (manager: typeof first) => <StrictMode><PreferenceProvider manager={manager}><DisplaySettings sessionKey="same" renderPreferences={props => <Preferences {...props} />} /></PreferenceProvider></StrictMode>;
  const view = await renderWidgets(scene(first));
  view.rerender(scene(second));
  fireEvent.keyDown(window, { key: ',', ctrlKey: true });
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => { second.update({ shortcut: { enabled: true } }); });
  fireEvent.keyDown(window, { key: ',', ctrlKey: true });
  expect(await screen.findByRole('dialog', { name: 'Fixture preferences' })).toBeVisible();
});
