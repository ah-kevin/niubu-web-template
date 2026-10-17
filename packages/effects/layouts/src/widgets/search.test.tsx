import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { CommandSearch } from './CommandSearch';
import CommandSearchDialog from './CommandSearchDialog';
import type { ObjectSearchResult, SearchConfiguration } from './types';
import { deferred, renderWidgets } from './widget-test-utils';
const renderLink: SearchConfiguration['renderLink'] = props => <a {...props} />;
const renderDialog = (props: React.ComponentProps<typeof CommandSearchDialog>) => <CommandSearchDialog {...props} />;

it('searches only injected authorized items and preserves link keyboard navigation', async () => {
  await renderWidgets(<CommandSearch sessionKey="one" locale="en-US" pages={[{ id: 'page-a', title: 'Page Alpha', description: 'Visible section', href: '/alpha?view=list' }]} loadObjects={async () => ({ status: 'ready', data: [{ id: 'object-b', title: 'Object Beta', description: 'Visible object', href: '/beta' }] })} renderLink={renderLink} renderDialog={renderDialog} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Search pages/ }));
  const dialog = await screen.findByRole('dialog');
  const input = within(dialog).getByRole('searchbox');
  expect(input).toHaveFocus();
  expect(within(dialog).getByRole('link', { name: /Page Alpha/ })).toHaveAttribute('href', '/alpha?view=list');
  expect(await within(dialog).findByRole('link', { name: /Object Beta/ })).toHaveAttribute('href', '/beta');
  await user.type(input, 'beta');
  expect(within(dialog).queryByRole('link', { name: /Page Alpha/ })).toBeNull();
  const object = within(dialog).getByRole('link', { name: /Object Beta/ });
  await user.keyboard('{ArrowDown}'); expect(object).toHaveFocus();
  await user.keyboard('{ArrowUp}'); expect(input).toHaveFocus();
  await user.type(input, ' unknown');
  expect(within(dialog).queryAllByRole('link')).toHaveLength(0);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: /Search pages/ })).toHaveFocus();
});

it('aborts a closed search and excludes its late objects from the next session', async () => {
  const gate = deferred<ObjectSearchResult>();
  let oldSignal: AbortSignal | undefined;
  const scene = (sessionKey: string) => <><CommandSearch sessionKey={sessionKey} locale="en-US" pages={[]} loadObjects={signal => { oldSignal = signal; return gate.promise; }} renderLink={renderLink} renderDialog={renderDialog} /><input aria-label="Later focus" /></>;
  const view = await renderWidgets(scene('one'));
  fireEvent.click(screen.getByRole('button', { name: /Search pages/ }));
  await screen.findByRole('dialog');
  await userEvent.setup().keyboard('{Escape}');
  expect(oldSignal?.aborted).toBe(true);
  view.rerender(scene('two'));
  const input = screen.getByRole('textbox', { name: 'Later focus' }); input.focus();
  await act(async () => { gate.resolve({ status: 'ready', data: [{ id: 'old', title: 'Retired object', href: '/old' }] }); await gate.promise; });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('link', { name: /Retired object/ })).toBeNull();
  expect(input).toHaveFocus();
});

it('discards the old request when an open search configuration changes', async () => {
  const gate = deferred<ObjectSearchResult>();
  let oldSignal: AbortSignal | undefined;
  const view = await renderWidgets(<CommandSearchDialog contentId="search" locale="en-US" pages={[]} loadObjects={signal => { oldSignal = signal; return gate.promise; }} renderLink={renderLink} onClose={() => {}} returnFocus={() => {}} />);
  view.rerender(<CommandSearchDialog contentId="search" locale="en-US" pages={[]} loadObjects={async () => ({ status: 'ready', data: [{ id: 'new', title: 'Current object', href: '/current' }] })} renderLink={renderLink} onClose={() => {}} returnFocus={() => {}} />);
  expect(oldSignal?.aborted).toBe(true);
  await screen.findByRole('link', { name: /Current object/ });
  await act(async () => { gate.resolve({ status: 'ready', data: [{ id: 'old', title: 'Retired object', href: '/old' }] }); await gate.promise; });
  expect(screen.getByRole('link', { name: /Current object/ })).toBeVisible();
  expect(screen.queryByRole('link', { name: /Retired object/ })).toBeNull();
});
