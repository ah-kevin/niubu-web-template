import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useSchemaForm } from './useSchemaForm';
import { useForm } from 'react-hook-form';
import { ControlledField } from './ControlledField';

function Example({ submit }: { submit: () => Promise<void> }) {
  const schema = useSchemaForm<{ first: string; second: string }>({
    fields: [
      { name: 'first', kind: 'text', label: 'First', required: true },
      { name: 'second', kind: 'text', label: 'Second', required: true },
    ],
    defaultValues: { first: '', second: '' },
    onSubmit: submit,
  });
  return <schema.Form submitLabel="Save" />;
}
it('validates after blur, preserves values, and focuses the first invalid field on submit', async () => {
  const submit = vi.fn(async () => {});
  const user = userEvent.setup();
  render(<Example submit={submit} />);
  const first = screen.getByRole('textbox', { name: 'First' });
  expect(first).toHaveAttribute('aria-invalid', 'false');
  await user.click(first);
  await user.tab();
  await waitFor(() => expect(first).toHaveAttribute('aria-invalid', 'true'));
  const error = screen.getByRole('alert');
  expect(error.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(first).toHaveAttribute('aria-describedby', error.id);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(first).toHaveFocus());
  expect(submit).not.toHaveBeenCalled();
  await user.type(first, 'Ada');
  await user.tab();
  await waitFor(() => expect(first).toHaveAttribute('aria-invalid', 'false'));
  expect(first).toHaveValue('Ada');
});

it('propagates disabled state to field labels and individual option labels without discarding values', () => {
  function Fixture({ disabled }: { disabled: boolean }) {
    const form = useForm({ defaultValues: { name: 'Ada', channel: 'email', regions: ['a'] } });
    const options = [{ value: 'a', label: 'Region A' }, { value: 'b', label: 'Region B', disabled: true }];
    return <>
      <ControlledField control={form.control} name="name" kind="text" label="Name" disabled={disabled} />
      <ControlledField control={form.control} name="channel" kind="radio" label="Channel" disabled={disabled}
        componentProps={{ options: [{ value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS', disabled: true }] }} />
      <ControlledField control={form.control} name="regions" kind="checkbox-group" label="Regions" disabled={disabled} componentProps={{ options }} />
    </>;
  }
  const view = render(<Fixture disabled />);
  for (const label of ['Name', 'Channel', 'Regions', 'Email', 'SMS', 'Region A', 'Region B']) {
    expect(screen.getByText(label).closest('label')).toHaveAttribute('data-disabled');
  }
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
  view.rerender(<Fixture disabled={false} />);
  for (const label of ['Name', 'Channel', 'Regions', 'Email', 'Region A']) {
    expect(screen.getByText(label).closest('label')).not.toHaveAttribute('data-disabled');
  }
  expect(screen.getByText('SMS').closest('label')).toHaveAttribute('data-disabled');
  expect(screen.getByText('Region B').closest('label')).toHaveAttribute('data-disabled');
});
