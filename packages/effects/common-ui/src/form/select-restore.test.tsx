import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useForm, useWatch } from 'react-hook-form';
import { ControlledField } from './ControlledField';

it.each([false, true])('keeps restored controlled selection while native options register (empty option: %s)', async hasEmpty => {
  const submit = vi.fn();
  function Fixture() {
    const form = useForm({ defaultValues: { selection: 'a' } });
    const selection = useWatch({ control: form.control, name: 'selection' });
    useEffect(() => { form.reset({ selection: 'b' }, { keepDefaultValues: true }); }, [form]);
    return <form onSubmit={form.handleSubmit(submit)}>
      <ControlledField control={form.control} name="selection" kind="select" label="Selection" componentProps={{ options: [ ...(hasEmpty ? [{ value: '', label: 'None' }] : []), { value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] }} />
      <output aria-label="Current value">{selection}</output>
      <button type="submit">Review</button>
    </form>;
  }
  const { container } = render(<Fixture />);
  await waitFor(() => expect(container.querySelector('select option[value="b"]')).not.toBeNull());
  expect(screen.getByRole('combobox', { name: 'Selection' })).toHaveTextContent('Beta');
  expect(screen.getByLabelText('Current value')).toHaveTextContent('b');
  expect(new FormData(container.querySelector('form')!).get('selection')).toBe('b');
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith({ selection: 'b' }, expect.anything()));
});
