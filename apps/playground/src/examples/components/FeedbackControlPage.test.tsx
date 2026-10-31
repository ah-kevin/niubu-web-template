import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { FeedbackControlPage } from './FeedbackControlPage';
import { feedbackControlKinds } from './control-kinds';

it.each(feedbackControlKinds)('mounts only the %s feedback section', kind => {
  const { container } = render(<FeedbackControlPage kind={kind} />);
  expect(container.querySelectorAll('section.example-card')).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1, name: kind })).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open quick view' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Queue confirmation and alert' })).not.toBeInTheDocument();
  if (kind === 'Modal') expect(screen.queryByRole('button', { name: 'Open Drawer' })).not.toBeInTheDocument();
  if (kind === 'Drawer') expect(screen.queryByRole('button', { name: 'Open Modal' })).not.toBeInTheDocument();
  const triggers = { Modal: 'Open Modal', Drawer: 'Open Drawer', ConfirmDialog: 'Open danger confirmation', Popover: 'Open popover', DropdownMenu: 'Open dropdown menu', ContextMenu: 'Right-click for menu', EmptyState: 'Show empty source' };
  if (kind === 'Tooltip') expect(screen.getByLabelText('Focus or hover for help')).toBeInTheDocument();
  else if (kind === 'Loading') expect(screen.getByRole('progressbar', { name: 'Example progress' })).toBeInTheDocument();
  else expect(screen.getByRole('button', { name: triggers[kind] })).toBeInTheDocument();
});

it.each(['Modal', 'Drawer'] as const)('retains the %s save owner on its isolated page', async kind => {
  const saveRecord = vi.fn(async () => {});
  render(<FeedbackControlPage kind={kind} saveRecord={saveRecord} />);
  fireEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
  const dialog = await screen.findByRole('dialog', { name: `${kind}: Ada` });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Lin' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save example' }));
  expect(await screen.findByText('demo-7 · Lin')).toBeVisible();
  expect(saveRecord).toHaveBeenCalledOnce();
});

it('keeps the isolated popover interactive', async () => {
  render(<FeedbackControlPage kind="Popover" />);
  fireEvent.click(screen.getByRole('button', { name: 'Open popover' }));
  expect(await screen.findByText('This popover has an arrow. Press Escape to close it.')).toBeVisible();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByText('This popover has an arrow. Press Escape to close it.')).not.toBeInTheDocument();
});

it('keeps progress changes on the isolated loading page', () => {
  render(<FeedbackControlPage kind="Loading" />);
  fireEvent.click(screen.getByRole('button', { name: 'Advance progress' }));
  expect(screen.getByRole('progressbar', { name: 'Example progress' })).toHaveAttribute('aria-valuenow', '60');
  fireEvent.click(screen.getByRole('button', { name: 'Toggle indeterminate progress' }));
  expect(screen.getByRole('progressbar', { name: 'Example progress' })).not.toHaveAttribute('aria-valuenow');
});


it.each(['DropdownMenu', 'ContextMenu'] as const)('preserves interactive items on the isolated %s page', async kind => {
  render(<FeedbackControlPage kind={kind} />);
  if (kind === 'DropdownMenu') fireEvent.pointerDown(screen.getByRole('button', { name: 'Open dropdown menu' }), { button: 0, ctrlKey: false });
  else fireEvent.contextMenu(screen.getByRole('button', { name: 'Right-click for menu' }), { clientX: 12, clientY: 18 });
  expect(await screen.findByRole('menuitem', { name: 'Unavailable action' })).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Summary view' }));
  expect(await screen.findByText('Current selection: Summary view')).toBeVisible();
});

it('retains the standalone danger confirmation outcome', async () => {
  render(<FeedbackControlPage kind="ConfirmDialog" />);
  fireEvent.click(screen.getByRole('button', { name: 'Open danger confirmation' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirm danger action' });
  expect(dialog).toHaveAttribute('data-tone', 'danger');
  fireEvent.click(within(dialog).getByRole('button', { name: '确定' }));
  expect(await screen.findByText('Confirmed')).toBeVisible();
});

it.each(['Modal', 'Drawer'] as const)('switches %s sizes without replacing the editing draft', async kind => {
  const saveRecord = vi.fn(async () => {});
  render(<FeedbackControlPage kind={kind} saveRecord={saveRecord} />);
  fireEvent.click(screen.getByRole('button', { name: `Open ${kind}` }));
  const dialog = await screen.findByRole('dialog', { name: `${kind}: Ada` });
  const input = within(dialog).getByRole('textbox', { name: 'Name' });
  fireEvent.change(input, { target: { value: 'Size preview draft' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Use wide size' }));
  expect(dialog).toHaveClass(`w-[var(--${kind === 'Modal' ? 'dialog' : 'drawer'}-width-lg)]`);
  expect(input).toHaveValue('Size preview draft');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Use standard size' }));
  expect(dialog).not.toHaveClass(`w-[var(--${kind === 'Modal' ? 'dialog' : 'drawer'}-width-lg)]`);
  expect(input).toHaveValue('Size preview draft');
  expect(saveRecord).not.toHaveBeenCalled();
});

it.each([
  ['default', 'Open standard confirmation', 'Confirm sample action'],
  ['warning', 'Open warning confirmation', 'Confirm warning action'],
] as const)('demonstrates the %s confirmation with safe initial focus', async (tone, trigger, title) => {
  render(<FeedbackControlPage kind="ConfirmDialog" />);
  fireEvent.click(screen.getByRole('button', { name: trigger }));
  const dialog = await screen.findByRole('alertdialog', { name: title });
  expect(dialog).toHaveAttribute('data-tone', tone);
  expect(within(dialog).getByRole('button', { name: '取消' })).toHaveFocus();
  fireEvent.click(within(dialog).getByRole('button', { name: '确定' }));
  expect(await screen.findByText('Confirmed')).toBeVisible();
});

it('keeps empty-state reset actions on the isolated page', async () => {
  render(<FeedbackControlPage kind="EmptyState" />);
  fireEvent.click(screen.getByRole('button', { name: 'Show empty result' }));
  fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
  expect(await screen.findByText('Filters reset')).toBeVisible();
  expect(screen.queryByRole('button', { name: '清除筛选' })).not.toBeInTheDocument();
});
