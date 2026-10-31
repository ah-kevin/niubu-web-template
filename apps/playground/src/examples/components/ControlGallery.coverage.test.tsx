import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { ControlGallery } from './ControlGallery';

it('keeps an affixed search editable and preserves its value when disabled', async () => {
  const user = userEvent.setup();
  render(<ControlGallery only="Input" />);
  const input = screen.getByRole('searchbox', { name: 'Search records' });
  await user.type(input, 'sample');
  await user.click(screen.getByRole('switch', { name: 'Disable controls' }));
  expect(input).toBeDisabled();
  expect(input).toHaveValue('sample');
});

it('derives all and mixed checkbox states from the actual selected regions', async () => {
  const user = userEvent.setup();
  render(<ControlGallery only="Checkbox" />);
  const all = screen.getByRole('checkbox', { name: 'Select all regions' });
  const a = screen.getByRole('checkbox', { name: 'Region A' });
  const b = screen.getByRole('checkbox', { name: 'Region B' });
  await user.click(a);
  expect(all).toHaveAttribute('aria-checked', 'mixed');
  expect(b).not.toBeChecked();
  await user.click(all);
  expect(a).toBeChecked();
  expect(b).toBeChecked();
  await user.click(all);
  expect(a).not.toBeChecked();
  expect(b).not.toBeChecked();
  await user.click(screen.getByRole('switch', { name: 'Disable controls' }));
  for (const checkbox of [all, a, b]) expect(checkbox).toBeDisabled();
});

it('skips the unavailable radio option while the remaining group stays interactive', async () => {
  const user = userEvent.setup();
  render(<ControlGallery only="Radio" />);
  expect(screen.getByRole('radio', { name: 'Unavailable view' })).toBeDisabled();
  screen.getByRole('radio', { name: 'Default view' }).focus();
  await user.keyboard('{ArrowDown>}');
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Detailed view' })).toBeChecked());
  await user.keyboard('{/ArrowDown}');
});

it('pairs semantic status dots with visible labels and retains the notification count', async () => {
  const user = userEvent.setup();
  render(<ControlGallery only="Badge" />);
  for (const label of ['Online', 'Offline', 'Warning', 'Fault']) {
    const badge = screen.getByText(label).closest('[data-slot="badge"]')!;
    expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull();
  }
  await user.click(screen.getByRole('button', { name: 'Add notifications' }));
  await user.click(screen.getByRole('button', { name: 'Add notifications' }));
  expect(screen.getByText('99+')).toBeVisible();
  expect(screen.getByLabelText('New content')).toBeInTheDocument();
});

it('keeps ordinary card actions independent from selectable card state', async () => {
  const user = userEvent.setup();
  render(<ControlGallery only="Card" />);
  const ordinary = screen.getByText('Summary card').closest('[data-slot="card"]')!;
  expect(ordinary).not.toHaveAttribute('tabindex');
  const selectable = screen.getByRole('button', { name: 'Select card' });
  await user.click(within(ordinary as HTMLElement).getByRole('button', { name: 'All records' }));
  expect(screen.getByText('Performed: All records')).toBeVisible();
  await user.click(within(ordinary as HTMLElement).getByRole('button', { name: 'View summary' }));
  expect(selectable).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText('Performed: View summary')).toBeVisible();
  await user.click(within(ordinary as HTMLElement).getByRole('button', { name: 'Export summary' }));
  expect(screen.getByText('Performed: Export summary')).toBeVisible();
});

it('marks the helped label disabled with its input', async () => {
  const user = userEvent.setup();
  render(<ControlGallery only="Label" />);
  await user.click(screen.getByRole('switch', { name: 'Disable controls' }));
  expect(screen.getByText('Label with help')).toHaveAttribute('data-disabled');
  expect(screen.getByRole('textbox', { name: 'Label with help' })).toBeDisabled();
});
