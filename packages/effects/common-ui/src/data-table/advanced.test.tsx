import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import { createListColumnHelper, createSelectableColumnHelper } from './columns';
import { createDataTableLabels } from './labels';
import { mergeConsecutiveRows } from './advanced-helpers';
import type { TableEditing, TableReorder, TableColumnFilters } from './advanced-types';
import { Input } from '@niubu/shadcn-ui/input';

type Item = { id: string; group: string; value: number };
const rows: Item[] = [{ id: 'a', group: 'A', value: 1 }, { id: 'b', group: 'A', value: 2 }, { id: 'c', group: 'B', value: 3 }];
const h = createListColumnHelper<Item>();
const columns = h.columns([h.accessor('group', { id: 'group', header: 'Group' }), h.accessor('value', { id: 'value', header: 'Value' })]);
const labels = { ...createDataTableLabels((key, params) => params?.name ? `${key}:${params.name}` : key), pending: 'Loading', error: 'Failed', sourceEmpty: 'Source empty', filteredEmpty: 'No matches' };
const base = { columns, getRowId: (row: Item) => row.id, caption: 'Table', labels, readState: 'ready', resultCount: 3, sourceCount: 3 } as const;
const filters: TableColumnFilters<Item> = { mode: 'local', fields: { group: { label: 'Filter group' } }, matches: (row, _, value) => row.group.includes(value), clearLabel: 'Clear filters', activeLabel: 'Filtered' };
const ids = (container: HTMLElement) => [...container.querySelectorAll('tbody tr[data-row-id]')].map(row => row.getAttribute('data-row-id'));

it('filters local rows, marks active filters and clears empty results with table headers retained', () => {
  const { container } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} columnFilters={filters} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter group' }), { target: { value: 'missing' } });
  expect(ids(container)).toEqual([]);
  expect(screen.getByText('No matches')).toBeInTheDocument();
  expect(screen.getByText('Filtered')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /Group/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(ids(container)).toEqual(['a', 'b', 'c']);
});
it('leaves manual filtered data with its owner and emits a controlled update', () => {
  const update = vi.fn();
  const { container } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} columnFilters={{ ...filters, mode: 'manual', state: { kind: 'controlled', value: {}, onChange: update } }} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter group' }), { target: { value: 'B' } });
  expect(update).toHaveBeenCalledOnce();
  expect(update.mock.calls[0][0]({})).toEqual({ group: 'B' });
  expect(ids(container)).toEqual(['a', 'b', 'c']);
});
it('renders true merged cells and page summary, recalculating when filtered or columns hidden', () => {
  const { container, rerender } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} columnFilters={filters} cellSpan={mergeConsecutiveRows('group', row => row.group)} summary={{ label: 'Page total', renderCell: (id, page) => id === 'group' ? 'Page total' : page.reduce((sum, row) => sum + row.value, 0) }} />);
  expect(container.querySelector<HTMLTableCellElement>('tbody td')?.rowSpan).toBe(2);
  expect(container.querySelector('tfoot')).toHaveTextContent('6');
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter group' }), { target: { value: 'B' } });
  expect(container.querySelector<HTMLTableCellElement>('tbody td')?.rowSpan).toBe(1);
  expect(container.querySelector('tfoot')).toHaveTextContent('3');
  rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} cellSpan={() => ({ colSpan: 2 })} columnVisibility={{ kind: 'controlled', value: { group: false }, onChange: vi.fn() }} />);
  expect([...container.querySelectorAll('tbody td')].every(cell => (cell as HTMLTableCellElement).colSpan === 1)).toBe(true);
});
it('expands one detail row and preserves full width with merged cells', () => {
  const { container } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} cellSpan={mergeConsecutiveRows('group', row => row.group)} details={{ label: row => `Detail ${row.id}`, render: row => <p>{`Details of ${row.id}`}</p> }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Detail a' }));
  expect(screen.getByText('Details of a').closest('td')?.colSpan).toBe(3);
  expect(container.querySelector('tbody tr[data-row-id="a"] td[data-column-id="group"]')?.getAttribute('rowspan')).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: 'Detail a' }));
  expect(screen.queryByText('Details of a')).not.toBeInTheDocument();
});
const edit = (save: TableEditing<Item>['onSave']): TableEditing<Item> => ({
  createDraft: row => ({ ...row }),
  renderCell: ({ columnId, draft, setDraft, error, disabled }) => columnId === 'value' ? <><Input aria-label="Edit value" value={draft.value} disabled={disabled} onChange={e => setDraft({ ...draft, value: Number(e.target.value) })} />{error && <span role="alert">{error}</span>}</> : null,
  validate: (draft): Record<string, string> => draft.value > 0 ? {} : { value: 'Must be positive' }, onSave: save,
  labels: { edit: 'Edit', save: 'Save', cancel: 'Cancel', saving: 'Saving', failed: 'Save failed', actions: 'Actions' },
});
it('keeps drafts isolated, validates, preserves rejected drafts and aborts cancelled saves', async () => {
  let reject: (error: Error) => void = () => {};
  const save = vi.fn<TableEditing<Item>['onSave']>(() => new Promise((_, no) => { reject = no; }));
  render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} editing={edit(save)} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
  fireEvent.change(screen.getByRole('textbox', { name: 'Edit value' }), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Must be positive');
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Edit value' }), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(rows[0].value).toBe(1);
  await act(async () => reject(new Error('offline')));
  expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
  expect(screen.getByRole('textbox', { name: 'Edit value' })).toHaveValue('9');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const signal = save.mock.calls[1][1].signal;
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(signal.aborted).toBe(true);
  await act(async () => reject(new Error('late')));
  expect(screen.queryByText('Save failed')).not.toBeInTheDocument();
});
it('saves a draft through the owner and retires editing after async success', async () => {
  function Owner() {
    const [data, setData] = useState(rows);
    return <DataTable {...base} profile="list" model={{ kind: 'client', rows: data }} editing={edit(async draft => { setData(old => old.map(row => row.id === draft.id ? draft : row)); })} />;
  }
  const { container } = render(<Owner />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
  fireEvent.change(screen.getByRole('textbox', { name: 'Edit value' }), { target: { value: '8' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
  expect(within(container.querySelector('tr[data-row-id="a"]') as HTMLElement).getByText('8')).toBeInTheDocument();
  expect(rows[0].value).toBe(1);
});
const reorder = (save: TableReorder<Item>['onReorder']): TableReorder<Item> => ({ onReorder: save, labels: { handle: row => `Move ${row.id}`, disabled: 'Reorder unavailable', pickedUp: 'Picked up', saving: 'Saving order', failed: 'Order failed' } });
it('supports keyboard pickup/move/drop and rollback on failure without mutating rows', async () => {
  const save = vi.fn<TableReorder<Item>['onReorder']>(async () => { throw new Error('offline'); });
  const { container } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} reorder={reorder(save)} />);
  const handle = screen.getByRole('button', { name: 'Move a' });
  fireEvent.keyDown(handle, { key: ' ' });
  fireEvent.keyDown(handle, { key: 'ArrowDown' });
  expect(ids(container)).toEqual(['b', 'a', 'c']);
  await act(async () => fireEvent.keyDown(handle, { key: ' ' }));
  expect(save.mock.calls[0][0]).toEqual(['b', 'a', 'c']);
  expect(ids(container)).toEqual(['a', 'b', 'c']);
  expect(screen.getByRole('alert')).toHaveTextContent('Order failed');
});
it('cancels a keyboard move and disables reordering while filtered, sorted or paginated', () => {
  const save = vi.fn();
  const { container, rerender } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} reorder={reorder(save)} columnFilters={filters} />);
  const handle = screen.getByRole('button', { name: 'Move a' });
  fireEvent.keyDown(handle, { key: ' ' }); fireEvent.keyDown(handle, { key: 'ArrowDown' }); fireEvent.keyDown(handle, { key: 'Escape' });
  expect(ids(container)).toEqual(['a', 'b', 'c']); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter group' }), { target: { value: 'A' } });
  expect(screen.getByRole('button', { name: 'Move a' })).toBeDisabled();
  rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} reorder={reorder(save)} sorting={{ kind: 'controlled', value: [{ id: 'value', desc: true }], onChange: vi.fn() }} />);
  expect(screen.getByRole('button', { name: 'Move c' })).toBeDisabled();
  rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} reorder={reorder(save)} pagination={{ kind: 'controlled', value: { pageIndex: 0, pageSize: 1 }, onChange: vi.fn() }} />);
  expect(screen.getByRole('button', { name: 'Move a' })).toBeDisabled();
});
it('matches skeleton rows to page size, retains explicit refreshing data and keeps retry outside failed rows', () => {
  const { container, rerender } = render(<DataTable {...base} profile="list" readState="pending" sourceCount={null} resultCount={null} model={{ kind: 'client', rows: [] }} pagination={{ kind: 'internal', initial: { pageIndex: 0, pageSize: 7 } }} />);
  expect(container.querySelectorAll('[data-skeleton-row]')).toHaveLength(7);
  rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} refresh="pending" />);
  expect(ids(container)).toEqual(['a', 'b', 'c']);
  expect(container.querySelectorAll('[data-skeleton-row]')).toHaveLength(0);
  expect(screen.getByRole('status')).toHaveAccessibleName('Loading');
  rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} refresh="error" emptyAction={<button>Retry</button>} />);
  expect(ids(container)).toEqual(['a', 'b', 'c']);
  expect(screen.getByRole('alert').querySelector('button')).toHaveTextContent('Retry');
  expect(screen.getByRole('alert').closest('table')).toBeNull();
});
it('provides single selection radios without select-all and only retains one ID', () => {
  const sh = createSelectableColumnHelper<Item>();
  render(<DataTable {...base} profile="selectable-list" columns={sh.columns([sh.accessor('id', { id: 'id', header: 'ID' })])} model={{ kind: 'client', rows }} selectionMode="single" rowSelection={{ kind: 'internal' }} selectionLabels={{ selectPage: 'Select one', selectRow: id => `Select ${id}`, selected: count => `${count} selected`, selectAllResults: () => 'Select all', clearSelection: 'Clear', allResultsUnavailable: 'Unavailable' }} />);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Select all' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Select a' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Select b' }));
  expect(screen.getByRole('radio', { name: 'Select a' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'Select b' })).toBeChecked();
  expect(screen.getByText('1 selected')).toBeInTheDocument();
});

it('opens an initially controlled edit and aborts pending work on an owner change', async () => {
  const save = vi.fn<TableEditing<Item>['onSave']>(() => new Promise(() => {}));
  const config = { ...edit(save), rowId: { kind: 'controlled' as const, value: 'a', onChange: vi.fn() }, ownerKey: 'first' };
  const view = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} editing={config} />);
  expect(screen.getByRole('textbox', { name: 'Edit value' })).toHaveValue('1');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  view.rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} editing={{ ...config, ownerKey: 'second' }} />);
  expect(save.mock.calls[0][1].signal.aborted).toBe(true);
  expect(screen.getByRole('textbox', { name: 'Edit value' })).not.toBeDisabled();
});
