import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { expect, it } from 'vitest';
import { ControlledField } from './ControlledField';
import type { CustomFieldRenderProps } from './types';
type Values = { name: string };
function Stateful({ field: { ref: inputRef, name, value, onBlur, onChange }, shell }: CustomFieldRenderProps<Values>) {
  const [count, setCount] = useState(0);
  return (
    <>
      <input {...shell} name={name} ref={inputRef} value={String(value)} onBlur={onBlur} onChange={onChange} />
      <button type="button" onClick={() => setCount(count + 1)}>
        Local {count}
      </button>
    </>
  );
}
function Harness({ custom }: { custom: boolean }) {
  const form = useForm<Values>({ defaultValues: { name: 'kept value' } });
  return (
    <ControlledField
      control={form.control}
      name="name"
      label="Name"
      kind={custom ? 'custom:stateful' : 'text'}
      customFields={{ 'custom:stateful': Stateful }}
    />
  );
}
it('mounts a custom field as its own React component so changing kind cannot corrupt hook order', () => {
  const view = render(<Harness custom />);
  fireEvent.click(screen.getByRole('button', { name: 'Local 0' }));
  expect(screen.getByRole('button', { name: 'Local 1' })).toBeVisible();
  view.rerender(<Harness custom={false} />);
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('kept value');
  view.rerender(<Harness custom />);
  expect(screen.getByRole('button', { name: 'Local 0' })).toBeVisible();
});
