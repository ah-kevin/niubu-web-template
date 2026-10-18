import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FormsPage } from './FormsPage';

// JSDOM lacks browser layout/pointer primitives required by the real Radix controls.
const methods = ['scrollIntoView', 'hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const;
const originalMethods = methods.map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
beforeAll(() => {
  for (const key of methods)
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, value: key === 'hasPointerCapture' ? () => false : () => {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerType = 'mouse'; pointerId = 1; });
});
afterAll(() => {
  for (const [key, descriptor] of originalMethods) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, key);
  }
  vi.unstubAllGlobals();
});

async function scenario(label: string) {
  await userEvent.click(screen.getByRole('button', { name: label }));
}
function output(label: string) {
  return screen.getByLabelText(label);
}

describe('FormsPage existing form capabilities', () => {
  it('shows an empty query state and restores results through reset', async () => {
    render(<FormsPage />);
    await scenario('Query and collapse');
    await waitFor(() => expect(screen.getByRole('list', { name: 'Query results' }).children).toHaveLength(3));
    await userEvent.type(screen.getByRole('textbox', { name: 'Keyword' }), 'no-such-name');
    await userEvent.click(screen.getByRole('button', { name: 'Apply query' }));
    expect(await screen.findByText('没有匹配记录')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset query' }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Query results' }).children).toHaveLength(3));
    expect(screen.queryByText('没有匹配记录')).not.toBeInTheDocument();
  });
  it('switches among all nine scenarios without keeping the previous form owner', async () => {
    render(<FormsPage />);
    for (const label of ['Public API', '11 builtin fields', 'Columns and JSX', 'Custom renderer', 'Pure field derivation', 'Query and collapse', 'Synchronous validation', 'Focus on submit error', 'Raw values and DTO']) {
      await scenario(label);
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
      expect(document.querySelectorAll('form')).toHaveLength(1);
    }
  });

  it('uses get/set/reset, validation and patch on the actual form owner', async () => {
    render(<FormsPage />);
    await scenario('Public API');
    await userEvent.click(screen.getByRole('button', { name: 'Set example values' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Grace');
    await userEvent.click(screen.getByRole('button', { name: 'Read current name' }));
    expect(output('Current name')).toHaveTextContent('Grace');
    await userEvent.click(screen.getByRole('button', { name: 'Patch existing field' }));
    expect(screen.getByRole('textbox', { name: 'Locked name' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reset values' }));
    expect(screen.getByRole('textbox', { name: 'Locked name' })).toHaveValue('Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Validate values' }));
    await waitFor(() => expect(output('Operation status')).toHaveTextContent('Valid'));
  });

  it('cancels an in-flight save and drops its late completion, then allows a fresh save', async () => {
    render(<FormsPage />);
    await scenario('Public API');
    await userEvent.click(screen.getByRole('button', { name: 'Submit values' }));
    await waitFor(() => expect(output('Operation status')).toHaveTextContent('Pending'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel submit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Complete synthetic save' }));
    await waitFor(() => expect(output('Operation status')).toHaveTextContent('Cancelled'));
    expect(output('Submitted name')).toHaveTextContent('—');
    await userEvent.click(screen.getByRole('button', { name: 'Set example values' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit values' }));
    await waitFor(() => expect(output('Operation status')).toHaveTextContent('Pending'));
    await userEvent.click(screen.getByRole('button', { name: 'Complete synthetic save' }));
    await waitFor(() => expect(output('Submitted name')).toHaveTextContent('Grace'));
    expect(output('Operation status')).toHaveTextContent('Submitted');
  });

  it.each(['Reset values', 'Set example values', 'Patch existing field'])('retires a pending save on %s', async action => {
    render(<FormsPage />);
    await scenario('Public API');
    await userEvent.click(screen.getByRole('button', { name: 'Submit values' }));
    await waitFor(() => expect(output('Operation status')).toHaveTextContent('Pending'));
    await userEvent.click(screen.getByRole('button', { name: action }));
    await userEvent.click(screen.getByRole('button', { name: 'Complete synthetic save' }));
    await waitFor(() => expect(output('Operation status')).toHaveTextContent('Cancelled'));
    expect(output('Submitted name')).toHaveTextContent('—');
  });

  it('unmounts pending owners on scenario change and starts with fresh local state', async () => {
    render(<FormsPage />);
    await scenario('Public API');
    await userEvent.click(screen.getByRole('button', { name: 'Submit values' }));
    await waitFor(() => expect(output('Operation status')).toHaveTextContent('Pending'));
    await scenario('11 builtin fields');
    await scenario('Public API');
    expect(output('Operation status')).toHaveTextContent('Idle');
    expect(output('Submitted name')).toHaveTextContent('—');
    expect(screen.queryByRole('button', { name: 'Complete synthetic save' })).not.toBeInTheDocument();
  });

  it('binds all eleven builtin kinds and excludes the synthetic password from public preview', async () => {
    render(<FormsPage />);
    await scenario('11 builtin fields');
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    await userEvent.type(screen.getByRole('textbox', { name: 'Notes' }), 'Demo note');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity' }), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Synthetic password'), { target: { value: 'synthetic-only' } });
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Research' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Accepted' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Express' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Enabled' }));
    fireEvent.change(screen.getByLabelText('Date', { exact: true }), { target: { value: '2026-10-17' } });
    fireEvent.change(screen.getByLabelText('Date range 开始日期'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Date range 结束日期'), { target: { value: '2026-10-31' } });
    await userEvent.click(screen.getByRole('button', { name: 'Preview public fields' }));
    expect(JSON.parse(output('Builtin preview').textContent!)).toEqual({
      name: 'Ada', notes: 'Demo note', quantity: 4, category: 'research', accepted: true,
      channels: ['email'], delivery: 'express', enabled: true, date: '2026-10-17',
      range: { start: '2026-10-01', end: '2026-10-31' },
    });
    expect(output('Builtin preview')).not.toHaveTextContent('synthetic-only');
  });

  it('resets the builtin selection through the existing form owner and keeps its public preview', async () => {
    render(<FormsPage />);
    await scenario('11 builtin fields');
    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Research' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset values' }));
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('General');
    await userEvent.click(screen.getByRole('button', { name: 'Preview public fields' }));
    expect(JSON.parse(output('Builtin preview').textContent!)).toMatchObject({ category: 'general' });
  });

  it('composes one form with columns, a spanning field and named JSX sections', async () => {
    render(<FormsPage />);
    await scenario('Columns and JSX');
    const primary = screen.getByRole('region', { name: 'Primary fields' });
    const details = screen.getByRole('region', { name: 'Details' });
    await userEvent.type(within(primary).getByRole('textbox', { name: 'Name' }), 'Ada');
    await userEvent.type(within(details).getByRole('textbox', { name: 'Notes' }), 'Shared owner');
    expect(details.querySelector('[data-schema-field="notes"]')).toHaveStyle('--schema-col-span: 2');
    expect(primary.querySelector('.pattern-schema-fields')).toHaveStyle('--schema-columns: 2');
    await userEvent.click(screen.getByRole('button', { name: 'Submit layout' }));
    await waitFor(() => expect(output('Layout result')).toHaveTextContent('Ada / Shared owner'));
  });

  it('binds a typed custom renderer including ref, error accessibility and focus', async () => {
    render(<FormsPage />);
    await scenario('Custom renderer');
    const code = screen.getByRole('textbox', { name: 'Code' });
    await userEvent.clear(code);
    await userEvent.type(code, 'bad');
    await userEvent.click(screen.getByRole('button', { name: 'Submit code' }));
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAccessibleDescription('Use EX- followed by digits');
    expect(output('Custom result')).toHaveTextContent('—');
    await userEvent.clear(code);
    await userEvent.type(code, 'EX-42');
    await userEvent.click(screen.getByRole('button', { name: 'Submit code' }));
    await waitFor(() => expect(output('Custom result')).toHaveTextContent('EX-42'));
  });

  it('derives visibility, required validation and disabled state without losing hidden raw values', async () => {
    render(<FormsPage />);
    await scenario('Pure field derivation');
    expect(screen.queryByRole('textbox', { name: 'Company' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Business account' }));
    const company = screen.getByRole('textbox', { name: 'Company' });
    expect(company).toHaveAttribute('aria-required', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Submit derived fields' }));
    await waitFor(() => expect(company).toHaveFocus());
    await userEvent.type(company, 'Example Labs');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lock company' }));
    expect(company).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Submit derived fields' }));
    await waitFor(() => expect(output('Derived result')).toHaveTextContent('Example Labs'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Business account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit derived fields' }));
    await waitFor(() => expect(JSON.parse(output('Derived result').textContent!)).toEqual({ business: false, locked: true }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Business account' }));
    expect(screen.getByRole('textbox', { name: 'Company' })).toHaveValue('Example Labs');
  });

  it('collapses query rows while keeping a single owner, applies a trimmed DTO and resets results', async () => {
    render(<FormsPage />);
    await scenario('Query and collapse');
    await waitFor(() => expect(screen.getByRole('list', { name: 'Query results' }).children).toHaveLength(3));
    expect(screen.getByLabelText('City')).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('textbox', { name: 'City' })).toBeVisible();
    await userEvent.type(screen.getByRole('textbox', { name: 'Keyword' }), '  Ada  ');
    await userEvent.type(screen.getByRole('textbox', { name: 'City' }), 'London');
    await userEvent.click(screen.getByRole('button', { name: 'Apply query' }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Query results' }).children).toHaveLength(1));
    expect(screen.getByRole('list', { name: 'Query results' })).toHaveTextContent('Ada / London');
    expect(screen.getByRole('textbox', { name: 'Keyword' })).toHaveValue('  Ada  ');
    await userEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.getByLabelText('City')).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Reset query' }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Query results' }).children).toHaveLength(3));
    expect(screen.getByRole('textbox', { name: 'Keyword' })).toHaveValue('');
    expect(screen.getByLabelText('City')).toHaveValue('');
  });

  it('rejects invalid synchronous Zod input and keeps parse normalization out of raw input', async () => {
    render(<FormsPage />);
    await scenario('Synchronous validation');
    const name = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.type(name, ' ');
    await userEvent.click(screen.getByRole('button', { name: 'Submit validated values' }));
    expect(await screen.findByText('Enter at least two characters')).toBeVisible();
    expect(output('Validated name')).toHaveTextContent('—');
    await userEvent.clear(name);
    await userEvent.type(name, '  Ada  ');
    await userEvent.click(screen.getByRole('button', { name: 'Submit validated values' }));
    await waitFor(() => expect(output('Validated name').textContent).toBe('  Ada  '));
    expect(name).toHaveValue('  Ada  ');
  });

  it('focuses the first visible invalid control and expands a collapsed invalid row on submit', async () => {
    render(<FormsPage />);
    await scenario('Focus on submit error');
    expect(screen.queryByLabelText('Hidden invalid field')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name', { exact: true })).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Submit and focus' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toBeVisible();
    expect(output('Focus result')).toHaveTextContent('—');
    await userEvent.type(name, 'Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Submit and focus' }));
    await waitFor(() => expect(output('Focus result')).toHaveTextContent('Ada'));
  });

  it('keeps raw range strings and converts only the chosen public fields to a one-way DTO', async () => {
    render(<FormsPage />);
    await scenario('Raw values and DTO');
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), '  Ada  ');
    fireEvent.change(screen.getByLabelText('Date range 开始日期'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Date range 结束日期'), { target: { value: '2026-10-31' } });
    await userEvent.click(screen.getByRole('button', { name: 'Compare raw and DTO' }));
    expect(JSON.parse(output('Raw example fields').textContent!)).toEqual({ name: '  Ada  ', range: { start: '2026-10-01', end: '2026-10-31' } });
    expect(JSON.parse(output('Output DTO fields').textContent!)).toEqual({ displayName: 'Ada', startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('  Ada  ');
    await userEvent.click(screen.getByRole('button', { name: 'Set raw example' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('  Grace  ');
    await userEvent.click(screen.getByRole('button', { name: 'Compare raw and DTO' }));
    expect(JSON.parse(output('Raw example fields').textContent!).range.start).toBe('2026-11-01');
    expect(screen.getByLabelText('Date range 开始日期')).toHaveValue('2026-11-01');
  });
});
