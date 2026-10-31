import { readFileSync } from 'node:fs';
import { mergeConsecutiveRows } from './advanced-helpers';
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import { createListColumnHelper, createSelectableColumnHelper } from './columns';
import { createDataTableLabels } from './labels';
import type { TableEditing, TableReorder, MultiColumnFilterValues } from './advanced-types';
import { Input } from '@niubu/shadcn-ui/input';

type Item = { id: string; status: string; value: number };
const rows: Item[] = [{ id: 'a', status: 'normal', value: 1 }, { id: 'b', status: 'pending', value: 2 }, { id: 'c', status: 'done', value: 3 }];
const h = createListColumnHelper<Item>();
const columns = h.columns([h.accessor('id', { id: 'id', header: 'ID' }), h.accessor('status', { id: 'status', header: 'Status' }), h.accessor('value', { id: 'value', header: 'Value' })]);
const labels = createDataTableLabels((key, params) => params?.name ? `${key}:${params.name}` : key);
const base = { columns, getRowId: (row: Item) => row.id, caption: 'Review', labels, readState: 'ready', sourceCount: 3, resultCount: 3 } as const;
const editing = (save: TableEditing<Item>['onSave']): TableEditing<Item> => ({
  createDraft: row => ({ ...row }), validate: () => ({}), onSave: save,
  renderCell: ({ draft, columnId, setDraft, disabled }) => columnId === 'value' ? <Input aria-label="Value input" disabled={disabled} value={draft.value} onChange={e => setDraft({ ...draft, value: Number(e.target.value) })} /> : null,
  labels: { edit: 'Edit', save: 'Save', cancel: 'Cancel', saving: 'Saving', failed: 'Failed', actions: 'Actions' },
});
const reorder = (save: TableReorder<Item>['onReorder'], ownerKey = 'first'): TableReorder<Item> => ({ ownerKey, onReorder: save, labels: { handle: row => `Move ${row.id}`, pickedUp: 'Picked', disabled: 'Disabled', saving: 'Saving order', failed: 'Order failed' } });
const moveFirst = () => { const handle = screen.getByRole('button', { name: 'Move a' }); fireEvent.keyDown(handle, { key: ' ' }); fireEvent.keyDown(handle, { key: 'ArrowDown' }); fireEvent.keyDown(handle, { key: ' ' }); };

it('requires finishing a new edit before another row can start, then cancellation removes the new row', () => {
  const cancel = vi.fn();
  function Owner() {
    const [data, setData] = useState([{ id: 'new', status: '', value: 0 }, ...rows]);
    const [id, setId] = useState<string | null>('new');
    return <DataTable {...base} sourceCount={data.length} resultCount={data.length} profile="list" model={{ kind: 'client', rows: data }} editing={{ ...editing(vi.fn()), rowId: { kind: 'controlled', value: id, onChange: setId }, onCancel: row => { cancel(row.id); setData(old => old.filter(item => item.id !== 'new')); } }} />;
  }
  const { container } = render(<Owner />);
  const otherEdit = within(container.querySelector('tr[data-row-id="a"]')!).getByRole('button', { name: 'Edit' });
  expect(otherEdit).toBeDisabled(); fireEvent.click(otherEdit);
  expect(container.querySelector('tr[data-row-id="new"]')).toHaveAttribute('data-editing', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(cancel).toHaveBeenCalledWith('new');
  expect(container.querySelector('tr[data-row-id="new"]')).toBeNull();
  expect(otherEdit).not.toBeDisabled();
});
it('disables current fields and save when eligibility is revoked and aborts an outstanding save', async () => {
  let resolve!: () => void;
  const save = vi.fn<TableEditing<Item>['onSave']>(() => new Promise(done => { resolve = done; }));
  const config = editing(save);
  const view = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} editing={config} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
  view.rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} editing={{ ...config, canEdit: () => false }} />);
  expect(screen.getByRole('textbox', { name: 'Value input' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save' })); expect(save).not.toHaveBeenCalled();
  view.rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} editing={config} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const signal = save.mock.calls[0][1].signal;
  view.rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} editing={{ ...config, canEdit: () => false }} />);
  expect(signal.aborted).toBe(true);
  await act(async () => resolve());
  expect(screen.getByRole('textbox', { name: 'Value input' })).toBeDisabled();
});
it.each(['owner', 'callback', 'removed'] as const)('retires reorder on %s changes and ignores an abort-ignoring late rejection', async change => {
  let reject!: (error: Error) => void;
  const oldSave = vi.fn<TableReorder<Item>['onReorder']>(() => new Promise((_, no) => { reject = no; }));
  const nextSave = vi.fn<TableReorder<Item>['onReorder']>(() => new Promise(() => {}));
  const view = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} reorder={reorder(oldSave)} />);
  moveFirst(); const signal = oldSave.mock.calls[0][1].signal;
  const next = change === 'removed' ? undefined : reorder(change === 'callback' ? nextSave : oldSave, change === 'owner' ? 'second' : 'first');
  view.rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} reorder={next} />);
  expect(signal.aborted).toBe(true);
  if (change !== 'removed') { expect(screen.getByRole('button', { name: 'Move a' })).not.toBeDisabled(); }
  if (change === 'callback') moveFirst();
  await act(async () => reject(new Error('late')));
  expect(screen.queryByText('Order failed')).toBeNull();
  if (change === 'callback') expect(screen.getByRole('button', { name: 'Move a' })).toBeDisabled();
});
it('resets filter, detail and edit internal initial values after controlled ownership', () => {
  const renderTable = (controlled: boolean) => <DataTable {...base} profile="list" model={{ kind: 'client', rows }}
    columnFilters={{ mode: 'local', fields: { status: { label: 'Filter status' } }, clearLabel: 'Clear', activeLabel: 'Filtered', matches: (row, _, value) => row.status === value, state: controlled ? { kind: 'controlled', value: { status: 'normal' }, onChange: vi.fn() } : { kind: 'internal', initial: { status: 'pending' } } }}
    details={{ expanded: controlled ? { kind: 'controlled', value: { a: true }, onChange: vi.fn() } : { kind: 'internal', initial: { b: true } }, label: row => `Detail ${row.id}`, render: row => <p>{`Expanded ${row.id}`}</p> }}
    editing={{ ...editing(vi.fn()), rowId: controlled ? { kind: 'controlled', value: 'a', onChange: vi.fn() } : { kind: 'internal', initial: 'b' } }} />;
  const view = render(renderTable(true));
  view.rerender(renderTable(false));
  expect(view.container.querySelector('tr[data-row-id="a"]')).toBeNull();
  expect(view.container.querySelector('tr[data-row-id="b"]')).toHaveAttribute('data-editing', 'true');
  expect(screen.getByText('Expanded b')).toBeInTheDocument();
});
it('applies typed multi-value OR filters only on Apply and clears all values', () => {
  let values: MultiColumnFilterValues = {};
  function Owner() {
    const [state, setState] = useState<MultiColumnFilterValues>({}); values = state;
    return <DataTable {...base} profile="list" model={{ kind: 'client', rows }} columnFilters={{ selection: 'multiple', mode: 'local', state: { kind: 'controlled', value: state, onChange: setState }, fields: { status: { label: 'Filter status', options: [{ value: 'normal', label: 'Normal' }, { value: 'pending', label: 'Pending' }, { value: 'done', label: 'Done' }] } }, clearLabel: 'Clear', applyLabel: 'Apply', activeLabel: 'Filtered', matches: (row, _, value) => row.status === value }} />;
  }
  const view = render(<Owner />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter status' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Normal' })); fireEvent.click(screen.getByRole('checkbox', { name: 'Pending' }));
  expect(view.container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(values.status).toEqual(['normal', 'pending']);
  expect(view.container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Filter status' })).toHaveAttribute('data-filtered', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Clear: Filter status' }));
  expect(view.container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(3);
});
it('opts into none-ascending-descending-none sorting without changing the old default', () => {
  const view = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} enableSortingRemoval />);
  const sort = screen.getByRole('button', { name: 'common:table.sortColumn:value' });
  const header = sort.closest('th');
  expect(header).toHaveAttribute('aria-sort', 'none');
  fireEvent.click(sort); expect(header).toHaveAttribute('aria-sort', 'ascending');
  fireEvent.click(sort); expect(header).toHaveAttribute('aria-sort', 'descending');
  fireEvent.click(sort); expect(header).toHaveAttribute('aria-sort', 'none');
  view.rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} />);
  fireEvent.click(sort); fireEvent.click(sort); fireEvent.click(sort);
  expect(header).not.toHaveAttribute('aria-sort', 'none');
});
it('skips ineligible rows in all/page selection and selects a single row only from noninteractive cells', () => {
  const sh = createSelectableColumnHelper<Item>(); const action = vi.fn();
  const selectable = sh.columns([sh.accessor('id', { id: 'id', header: 'ID' }), sh.display({ id: 'action', header: 'Action', cell: () => <><button onClick={action}>Inner action</button><a href="#row-link" onClick={event => event.preventDefault()}>Inner link</a></> })]);
  const selectionLabels = { selectPage: 'Select page', selectRow: (id: string) => `Select ${id}`, selected: (count: number) => `${count} selected`, selectAllResults: () => 'All results', clearSelection: 'Clear selection', allResultsUnavailable: 'Unavailable' };
  const props = { ...base, columns: selectable, selectionLabels, canSelectRow: (row: Item) => row.id !== 'b' };
  const view = render(<DataTable {...props} profile="selectable-list" model={{ kind: 'client', rows }} rowSelection={{ kind: 'internal' }} />);
  expect(screen.getByRole('checkbox', { name: 'Select b' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select page' })); expect(screen.getByText('2 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' })); fireEvent.click(screen.getByRole('button', { name: 'All results' }));
  expect(screen.getByRole('checkbox', { name: 'Select b' })).not.toBeChecked();
  view.rerender(<DataTable {...props} profile="selectable-list" selectionMode="single" model={{ kind: 'client', rows }} rowSelection={{ kind: 'internal' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Inner action' })[0]);
  fireEvent.click(screen.getAllByRole('link', { name: 'Inner link' })[0]);
  expect(screen.getByRole('radio', { name: 'Select a' })).not.toBeChecked();
  fireEvent.click(within(view.container.querySelector('tr[data-row-id="a"]')!).getByText('a'));
  expect(screen.getByRole('radio', { name: 'Select a' })).toBeChecked();
  fireEvent.click(within(view.container.querySelector('tr[data-row-id="b"]')!).getByText('b'));
  expect(screen.getByRole('radio', { name: 'Select a' })).toBeChecked();
});

it('highlights every row in a merged group, including a striped pinned origin, then clears on leave', () => {
  const style = document.createElement('style');
  style.textContent = readFileSync('src/data-table/advanced-styles.css', 'utf8') + '\n' + readFileSync('src/data-table/styles.css', 'utf8').replace(/^@import.*$/gm, '');
  document.head.append(style);
  try {
    const { container } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows: [{ ...rows[0], status: 'x' }, { ...rows[1], status: 'group' }, { ...rows[2], status: 'group' }] }} layout={{ striped: true }} columnPinning={{ kind: 'internal', initial: { start: ['status'], end: [] } }} cellSpan={mergeConsecutiveRows('status', row => row.status)} />);
    const origin = container.querySelector<HTMLTableRowElement>('tr[data-row-id="b"]')!;
    const later = container.querySelector<HTMLTableRowElement>('tr[data-row-id="c"]')!;
    fireEvent.mouseOver(later);
    expect(origin).toHaveAttribute('data-merge-hover', 'true');
    expect(later).toHaveAttribute('data-merge-hover', 'true');
    expect(origin.querySelector('[data-column-id="status"]')).toHaveAttribute('rowspan', '2');
    expect(getComputedStyle(origin).getPropertyValue('--table-row-background')).toBe('var(--table-row-hover)');
    fireEvent.mouseOut(later);
    expect(origin).not.toHaveAttribute('data-merge-hover');
    expect(later).not.toHaveAttribute('data-merge-hover');
  } finally { style.remove(); }
});

it('keeps the new owner preview and pending state when an old reorder resolves after ignoring abort', async () => {
  let resolve!: () => void;
  const first = vi.fn<TableReorder<Item>['onReorder']>(() => new Promise(done => { resolve = done; }));
  const second = vi.fn<TableReorder<Item>['onReorder']>(() => new Promise(() => {}));
  const view = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} reorder={reorder(first)} />);
  moveFirst();
  const nextRows = rows.map(row => ({ ...row, status: 'new owner' }));
  view.rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows: nextRows }} reorder={reorder(second, 'second')} />);
  moveFirst();
  await act(async () => resolve());
  expect(view.container.querySelector('tbody tr[data-row-id]')).toHaveAttribute('data-row-id', 'b');
  expect(screen.getByRole('button', { name: 'Move a' })).toBeDisabled();
  expect(screen.getByText('Saving order')).toBeInTheDocument();
  expect(first.mock.calls[0][1].signal.aborted).toBe(true);
});
