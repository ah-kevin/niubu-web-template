import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useSchemaForm } from './useSchemaForm';

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
