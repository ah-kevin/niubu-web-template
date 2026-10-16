import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { ControlledField } from './ControlledField';
import type { BuiltinFieldKind, CustomFieldRegistry, FormFieldConfig } from './types';
import { Select } from '@niubu/shadcn-ui/select';
import { Tooltip } from '@niubu/shadcn-ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@niubu/shadcn-ui/popover';
import { registerPendingOverlay } from '@niubu/shadcn-ui/overlay-ownership';

// JSDOM does not implement the pointer capture or scrolling used by Radix portals.
const browserMethods = ['scrollIntoView', 'hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const;
const originalMethods = browserMethods.map(
  key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const,
);
beforeAll(() => {
  for (const key of browserMethods)
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      value: key === 'hasPointerCapture' ? () => false : () => {},
    });
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerType = 'mouse';
      pointerId = 1;
    },
  );
});
afterAll(() => {
  for (const [key, descriptor] of originalMethods) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, key);
  }
  vi.unstubAllGlobals();
});
type Values = {
  text: string;
  textarea: string;
  password: string;
  number: number | null;
  numeric: string;
  select: string;
  checkbox: boolean;
  choices: string[];
  radio: string;
  switch: boolean;
  date: string;
  range: { start: string; end: string };
  custom: string;
};
const defaults: Values = {
  text: '',
  textarea: '',
  password: '',
  number: null,
  numeric: '',
  select: '',
  checkbox: false,
  choices: [],
  radio: '',
  switch: false,
  date: '',
  range: { start: '', end: '' },
  custom: '',
};
const options = [
  { value: '', label: 'None' },
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
type CustomParams = { 'custom:sample': { prefix: string } };
const checkedCustomConfig: FormFieldConfig<Values, CustomParams> = {
  name: 'custom',
  label: 'custom',
  kind: 'custom:sample',
  componentProps: { prefix: 'value' },
};
const rejectedCustomConfig: FormFieldConfig<Values, CustomParams> = {
  name: 'custom',
  label: 'custom',
  kind: 'custom:sample',
  // @ts-expect-error custom component params are checked against the app-owned map
  componentProps: { prefix: 42 },
};
void [checkedCustomConfig, rejectedCustomConfig];
const customFields: CustomFieldRegistry<Values, { 'custom:sample': { prefix: string } }> = {
  'custom:sample': ({ field, shell, params }) => (
    <input {...shell} {...field} value={field.value as string} placeholder={params.prefix} />
  ),
};
const submitted = vi.fn();
function Fixture({
  disabled = false,
  hostile = false,
  optionList = options,
}: {
  disabled?: boolean;
  hostile?: boolean;
  optionList?: readonly { value: string; label: string; disabled?: boolean }[];
}) {
  const form = useForm<Values>({ defaultValues: defaults });
  const values = useWatch({ control: form.control });
  const touched = form.formState.touchedFields;
  const binding = hostile
    ? {
        name: 'wrong',
        value: 'wrong',
        onChange: vi.fn(),
        onBlur: vi.fn(),
        ref: vi.fn(),
        onValueChange: vi.fn(),
        onCheckedChange: vi.fn(),
      }
    : {};
  return (
    <>
      {(['text', 'textarea', 'password', 'number', 'select', 'checkbox', 'radio', 'switch', 'date'] as const).map(
        kind => (
          <ControlledField
            key={kind}
            control={form.control}
            name={kind}
            label={kind}
            kind={kind}
            description={`${kind} help`}
            unit={kind === 'text' ? 'kg' : undefined}
            required
            disabled={disabled}
            componentProps={{ ...binding, options: optionList }}
          />
        ),
      )}
      <ControlledField
        control={form.control}
        name="numeric"
        label="numeric"
        kind="number"
        componentProps={{ valueMode: 'string', ...binding }}
      />
      <ControlledField
        control={form.control}
        name="choices"
        label="choices"
        kind="checkbox-group"
        componentProps={{ options: optionList }}
        disabled={disabled}
      />
      <ControlledField
        control={form.control}
        name="range"
        label="range"
        kind="date-range"
        description="range help"
        disabled={disabled}
      />
      <ControlledField
        control={form.control}
        name="custom"
        label="custom"
        kind="custom:sample"
        customFields={customFields}
        componentProps={{ prefix: 'app prefix' }}
      />
      <button onClick={() => form.setError('text', { message: 'text error' }, { shouldFocus: true })}>
        error text
      </button>
      <button onClick={() => form.setError('range', { message: 'range error' }, { shouldFocus: true })}>
        error range
      </button>
      <button onClick={() => form.setError('range.end', { message: 'end error' }, { shouldFocus: true })}>
        error end
      </button>
      <button onClick={() => form.setFocus('select')}>focus select</button>
      {(
        [
          'textarea',
          'password',
          'number',
          'numeric',
          'checkbox',
          'choices',
          'radio',
          'switch',
          'date',
          'custom',
        ] as const
      ).map(name => (
        <button key={name} onClick={() => form.setFocus(name)}>
          focus {name}
        </button>
      ))}
      <button
        onClick={() => {
          void form.handleSubmit(values => {
            submitted(values);
          })();
        }}
      >
        capture submit
      </button>
      <output data-testid="values">{JSON.stringify(values)}</output>
      <output data-testid="touched">{JSON.stringify(touched)}</output>
    </>
  );
}
function value() {
  return JSON.parse(screen.getByTestId('values').textContent ?? '{}') as Values;
}
it('protects RHF bindings, touches on blur, and labels without appending units', async () => {
  const user = userEvent.setup();
  render(<Fixture hostile />);
  const input = screen.getByRole('textbox', { name: 'text' });
  expect(input).toHaveAttribute('name', 'text');
  expect(input).toHaveAccessibleDescription('text help');
  expect(input).toHaveAttribute('aria-required', 'true');
  await user.type(input, 'hello');
  await user.tab();
  expect(value().text).toBe('hello');
  expect(screen.getByTestId('touched')).toHaveTextContent('"text":true');
  await user.click(screen.getByText('error text'));
  expect(input).toHaveFocus();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('text help text error');
  expect(screen.getByRole('alert')).toHaveTextContent('text error');
});
it('keeps textarea, password and date as controlled strings', async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  await user.type(screen.getByRole('textbox', { name: 'textarea' }), 'two\nlines');
  await user.type(screen.getByLabelText('password'), 'private');
  fireEvent.change(screen.getByLabelText('date'), { target: { value: '2026-10-17' } });
  fireEvent.blur(screen.getByLabelText('date'));
  expect(value()).toMatchObject({ textarea: 'two\nlines', password: 'private', date: '2026-10-17' });
  expect(screen.getByTestId('touched')).toHaveTextContent('"date":true');
});
it('keeps number null distinct from zero and string mode preserves empty and numeric spelling', () => {
  render(<Fixture hostile />);
  const number = screen.getByLabelText('number');
  const numeric = screen.getByLabelText('numeric');
  fireEvent.change(number, { target: { value: '0' } });
  expect(value().number).toBe(0);
  fireEvent.change(number, { target: { value: '' } });
  expect(value().number).toBeNull();
  fireEvent.change(number, { target: { value: 'invalid' } });
  expect(value().number).toBeNull();
  fireEvent.change(numeric, { target: { value: '01.20' } });
  expect(value().numeric).toBe('01.20');
  fireEvent.change(numeric, { target: { value: '' } });
  expect(value().numeric).toBe('');
});
it('supports keyboard checked state for boolean, checkbox groups, radio and switch', async () => {
  const user = userEvent.setup();
  render(<Fixture hostile />);
  const checkbox = screen.getByRole('checkbox', { name: 'checkbox' });
  checkbox.focus();
  await user.keyboard(' ');
  await user.tab();
  expect(value().checkbox).toBe(true);
  expect(screen.getByTestId('touched')).toHaveTextContent('"checkbox":true');
  const choice = screen.getByRole('checkbox', { name: 'Alpha' });
  choice.focus();
  await user.keyboard(' ');
  expect(value().choices).toEqual(['a']);
  await user.keyboard(' ');
  expect(value().choices).toEqual([]);
  const radio = screen.getByRole('radio', { name: 'Alpha' });
  radio.focus();
  await user.keyboard(' ');
  await user.keyboard('{ArrowRight>}');
  await waitFor(() => expect(value().radio).toBe('b'));
  await user.keyboard('{/ArrowRight}');
  const toggle = screen.getByRole('switch', { name: 'switch' });
  toggle.focus();
  await user.keyboard(' ');
  await user.tab();
  expect(value().switch).toBe(true);
  expect(screen.getByTestId('touched')).toHaveTextContent('"switch":true');
});
it('focuses select trigger, changes it by keyboard and maps an empty option without leaking a sentinel', async () => {
  const user = userEvent.setup();
  render(<Fixture hostile />);
  await user.click(screen.getByText('focus select'));
  const trigger = screen.getByRole('combobox', { name: 'select' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('name', 'select');
  expect(trigger).toHaveAccessibleDescription('select help');
  await user.keyboard('{ArrowDown}');
  await user.click(await screen.findByRole('option', { name: 'Alpha' }));
  expect(value().select).toBe('a');
  await user.click(trigger);
  await user.click(await screen.findByRole('option', { name: 'None' }));
  expect(value().select).toBe('');
  await user.tab();
  expect(screen.getByTestId('touched')).toHaveTextContent('"select":true');
});
it('retains disabled values and blocks interaction on all focusable group members', async () => {
  const user = userEvent.setup();
  render(<Fixture disabled />);
  for (const label of ['text', 'textarea', 'password', 'number', 'select', 'checkbox', 'switch', 'date'])
    expect(screen.getByLabelText(label)).toBeDisabled();
  for (const input of [...screen.getAllByRole('radio'), ...screen.getAllByRole('checkbox')])
    expect(input).toBeDisabled();
  await user.click(screen.getByRole('switch', { name: 'switch' }));
  expect(value()).toMatchObject({ switch: false, checkbox: false, choices: [] });
  await user.click(screen.getByText('capture submit'));
  await waitFor(() => expect(submitted).toHaveBeenLastCalledWith(defaults));
});
it('shares range help/errors across native date inputs and focuses root or nested errors correctly', async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  const start = screen.getByLabelText('range start');
  const end = screen.getByLabelText('range end');
  fireEvent.change(start, { target: { value: '2026-10-01' } });
  fireEvent.change(end, { target: { value: '2026-10-31' } });
  fireEvent.blur(end);
  expect(value().range).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  await user.click(screen.getByText('error range'));
  expect(start).toHaveFocus();
  expect(start).toHaveAccessibleDescription('range help range error');
  expect(end).toHaveAccessibleDescription('range help range error');
  await user.click(screen.getByText('error end'));
  expect(end).toHaveFocus();
  expect(end).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByTestId('touched')).toHaveTextContent('"range":true');
});
it('gives app custom renderers the real field, shell accessibility and typed params', async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  const custom = screen.getByRole('textbox', { name: 'custom' });
  expect(custom).toHaveAttribute('placeholder', 'app prefix');
  await user.type(custom, 'custom value');
  await user.tab();
  expect(value().custom).toBe('custom value');
  expect(screen.getByTestId('touched')).toHaveTextContent('"custom":true');
});
it('rejects unknown custom kinds and attempts to override builtins', () => {
  function Invalid({ kind, customFields: registry }: { kind: string; customFields?: object }) {
    const form = useForm<Values>({ defaultValues: defaults });
    return (
      <ControlledField
        control={form.control}
        name="text"
        label="text"
        kind={kind as BuiltinFieldKind}
        customFields={registry as CustomFieldRegistry<Values>}
      />
    );
  }
  expect(() => render(<Invalid kind="custom:missing" />)).toThrow(/custom:missing/);
  expect(() => render(<Invalid kind="text" customFields={{ text: () => null }} />)).toThrow(/custom:/);
});
it('keeps legacy Select props and Tooltip content wrapper usable', async () => {
  const change = vi.fn();
  const user = userEvent.setup();
  render(
    <>
      <Select label="legacy" value="a" onValueChange={change} options={options} />
      <Tooltip content="legacy tip">
        <button>tip</button>
      </Tooltip>
    </>,
  );
  await user.click(screen.getByRole('combobox', { name: 'legacy' }));
  await user.click(screen.getByRole('option', { name: 'Beta' }));
  expect(change).toHaveBeenCalledWith('b');
  await user.hover(screen.getByText('tip'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('legacy tip');
});
it('lets mounted popover and select portals consume Escape before the pending owner beneath', async () => {
  const user = userEvent.setup();
  const cancel = vi.fn();
  const unregister = registerPendingOverlay(window, cancel);
  try {
    render(
      <Popover>
        <PopoverTrigger>open popover</PopoverTrigger>
        <PopoverContent aria-label="details">
          <Select label="nested" value="a" onValueChange={() => {}} options={options} />
        </PopoverContent>
      </Popover>,
    );
    await user.click(screen.getByText('open popover'));
    await user.click(screen.getByRole('combobox', { name: 'nested' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(cancel).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(cancel).toHaveBeenCalledTimes(1);
  } finally {
    act(() => unregister());
  }
});

it.each([
  ['textarea', 'textarea'],
  ['password', 'password'],
  ['number', 'number'],
  ['numeric', 'numeric'],
  ['checkbox', 'checkbox'],
  ['choices', 'None'],
  ['radio', 'None'],
  ['switch', 'switch'],
  ['date', 'date'],
  ['custom', 'custom'],
])('forwards %s ref and name to a focusable control', async (name, label) => {
  const user = userEvent.setup();
  render(<Fixture hostile />);
  await user.click(screen.getByText(`focus ${name}`));
  const control =
    name === 'choices'
      ? screen.getByRole('checkbox', { name: label })
      : name === 'radio'
        ? screen.getByRole('radio', { name: label })
        : screen.getByLabelText(label);
  expect(control).toHaveFocus();
  expect(control).toHaveAttribute('name', name);
});
it('uses unique stable help and error IDs across form instances and rerenders', async () => {
  const user = userEvent.setup();
  const view = render(<Fixture />);
  const input = screen.getByRole('textbox', { name: 'text' });
  const id = input.id;
  await user.type(input, 'kept');
  view.rerender(<Fixture hostile />);
  expect(screen.getByRole('textbox', { name: 'text' })).toBe(input);
  expect(input).toHaveFocus();
  expect(input.id).toBe(id);
  expect(value().text).toBe('kept');
  render(<Fixture />);
  const textInputs = screen.getAllByRole('textbox', { name: 'text' });
  expect(textInputs[0].id).not.toBe(textInputs[1].id);
  expect(textInputs[0].getAttribute('aria-describedby')).not.toBe(textInputs[1].getAttribute('aria-describedby'));
});
it('announces a nested date-range error without requiring an earlier root error', async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  await user.click(screen.getByText('error end'));
  const start = screen.getByLabelText('range start');
  const end = screen.getByLabelText('range end');
  expect(end).toHaveFocus();
  expect(end).toHaveAccessibleDescription('range help end error');
  expect(start).toHaveAccessibleDescription('range help end error');
  expect(end).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('end error');
});
it('keeps the Select empty sentinel out of native form values too', () => {
  render(
    <form aria-label="native values">
      <Select name="parent" label="parent" value="" onValueChange={() => {}} options={options} />
    </form>,
  );
  const form = screen.getByRole('form', { name: 'native values' }) as HTMLFormElement;
  expect(new FormData(form).getAll('parent')).toEqual(['']);
});

it('focuses an enabled option when a checkbox or radio group starts with a disabled option', async () => {
  const user = userEvent.setup();
  render(
    <Fixture
      optionList={[
        { value: 'a', label: 'Disabled', disabled: true },
        { value: 'b', label: 'Enabled' },
      ]}
    />,
  );
  await user.click(screen.getByText('focus choices'));
  expect(screen.getByRole('checkbox', { name: 'Enabled' })).toHaveFocus();
  await user.click(screen.getByText('focus radio'));
  expect(screen.getByRole('radio', { name: 'Enabled' })).toHaveFocus();
});
