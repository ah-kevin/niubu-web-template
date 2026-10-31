import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Input, InputGroup, InputGroupAddon } from '../../packages/@core/ui-kit/shadcn-ui/src/input';

it('keeps the native input ref and form value while adornments focus the input', async () => {
  const ref = createRef<HTMLInputElement>();
  const user = userEvent.setup();
  const view = render(
    <form>
      <InputGroup aria-label="Search field">
        <InputGroupAddon aria-hidden="true">Search</InputGroupAddon>
        <Input ref={ref} aria-label="Query" name="query" defaultValue="cattle" />
        <InputGroupAddon aria-hidden="true">⌘K</InputGroupAddon>
      </InputGroup>
    </form>,
  );
  const input = screen.getByRole('textbox', { name: 'Query' });
  expect(ref.current).toBe(input);
  await user.click(screen.getByText('Search', { exact: true }));
  expect(input).toHaveFocus();
  await user.type(input, ' records');
  expect(new FormData(view.container.querySelector('form')!).get('query')).toBe('cattle records');
  expect(view.container.querySelectorAll('input')).toHaveLength(1);
});

it('retains read-only, disabled and error semantics in an input group', async () => {
  function Fixture() {
    const [disabled, setDisabled] = useState(false);
    return <>
      <InputGroup>
        <Input aria-label="Code" value="fixed" readOnly disabled={disabled} aria-invalid="true" aria-describedby="error" />
        <InputGroupAddon>Suffix</InputGroupAddon>
      </InputGroup>
      <p id="error">Invalid code</p>
      <button type="button" onClick={() => setDisabled(true)}>Disable</button>
    </>;
  }
  const user = userEvent.setup();
  render(<Fixture />);
  const input = screen.getByRole('textbox', { name: 'Code' });
  await user.type(input, 'new');
  expect(input).toHaveValue('fixed');
  expect(input).toHaveAccessibleDescription('Invalid code');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  await user.click(screen.getByRole('button', { name: 'Disable' }));
  await user.click(screen.getByText('Suffix'));
  expect(input).toBeDisabled();
  expect(input).not.toHaveFocus();
});
