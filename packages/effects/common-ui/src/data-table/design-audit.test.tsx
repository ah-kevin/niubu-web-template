import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import { createListColumnHelper, createSelectableColumnHelper } from './columns';
import { createDataTableLabels } from './labels';
import type { TableEditing } from './advanced-types';
import { Input } from '@niubu/shadcn-ui/input';

type Item = { id: string; name: string; value: number };
const rows: Item[] = [{ id: 'a', name: 'Alpha', value: 1 }, { id: 'b', name: 'Beta', value: 2 }, { id: 'c', name: 'Gamma', value: 3 }];
const helper = createListColumnHelper<Item>();
const columns = helper.columns([helper.accessor('name', { id: 'name', header: 'Name' }), helper.accessor('value', { id: 'value', header: 'Value' })]);
const labels = createDataTableLabels((key, params) => params?.name ? `${key}:${params.name}` : key);
const base = { columns, getRowId: (row: Item) => row.id, caption: 'Audit', labels, readState: 'ready', sourceCount: 3, resultCount: 3 } as const;

it('renders header help as its own trigger without changing sorting', () => {
  render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} columnHints={{ value: 'Weight explanation' }} />);
  const hint = screen.getByRole('button', { name: 'Weight explanation' });
  expect(hint.closest('th')).toContainElement(screen.getByRole('button', { name: 'common:table.sortColumn:value' }));
  fireEvent.click(hint);
  expect(hint.closest('th')).toHaveAttribute('aria-sort', 'none');
});

it('marks only eligible editable columns and places the add action after the final data row', () => {
  const add = vi.fn();
  const edit: TableEditing<Item> = {
    createDraft: row => ({ ...row }), validate: () => ({}), onSave: async () => {},
    editableColumns: ['value'], canEdit: row => row.id !== 'b', addRow: { label: 'Add row', onAdd: add },
    renderCell: ({ draft, columnId, setDraft }) => columnId === 'value' ? <Input aria-label="Value input" value={draft.value} onChange={event => setDraft({ ...draft, value: Number(event.target.value) })} /> : null,
    labels: { edit: 'Edit', save: 'Save', cancel: 'Cancel', saving: 'Saving', failed: 'Failed', actions: 'Actions' },
  };
  const { container } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} editing={edit} />);
  expect(container.querySelector('tr[data-row-id="a"] td[data-column-id="value"]')).toHaveAttribute('data-editable');
  expect(container.querySelector('tr[data-row-id="a"] td[data-column-id="name"]')).not.toHaveAttribute('data-editable');
  expect(container.querySelector('tr[data-row-id="b"] td[data-column-id="value"]')).not.toHaveAttribute('data-editable');
  expect(container.querySelector('tbody tr:last-child')).toHaveAttribute('data-add-row');
  fireEvent.click(screen.getByRole('button', { name: 'Add row' })); expect(add).toHaveBeenCalledOnce();
  fireEvent.click(within(container.querySelector('tr[data-row-id="a"]')!).getByRole('button', { name: 'Edit' }));
  expect(screen.getByRole('button', { name: 'Add row' })).toBeDisabled();
});

it('shows the cross-page prompt only after the selectable current page is fully checked', () => {
  const selectable = createSelectableColumnHelper<Item>();
  render(<DataTable {...base} profile="selectable-list" columns={selectable.columns([selectable.accessor('name', { id: 'name', header: 'Name' })])}
    model={{ kind: 'client', rows }} rowSelection={{ kind: 'internal' }} pagination={{ kind: 'internal', initial: { pageIndex: 0, pageSize: 2 } }}
    selectionLabels={{ selectPage: 'Select page', selectRow: id => `Select ${id}`, selected: count => `${count} selected`, selectAllResults: count => `All ${count}`, clearSelection: 'Clear', allResultsUnavailable: 'Unavailable' }} />);
  expect(screen.queryByText('已选中当前页 2 条。')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select page' }));
  expect(screen.getByText('已选中当前页 2 条。')).toBeVisible();
  expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute('data-variant', 'link');
  fireEvent.click(screen.getByRole('button', { name: 'All 3' }));
  expect(screen.getByText('3 selected')).toBeVisible();
  expect(screen.queryByText('已选中当前页 2 条。')).not.toBeInTheDocument();
});

it('tracks an explicit pointer drop target and clears keyboard placement on cancellation', () => {
  const save = vi.fn(async () => {});
  const { container } = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} reorder={{ ownerKey: 'audit', onReorder: save, labels: { handle: row => `Move ${row.id}`, pickedUp: 'Picked', disabled: 'Disabled', saving: 'Saving', failed: 'Failed' } }} />);
  const handle = screen.getByRole('button', { name: 'Move a' });
  const transfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
  fireEvent.dragStart(handle, { dataTransfer: transfer });
  const target = container.querySelector('tr[data-row-id="b"]')!;
  fireEvent.dragOver(target, { dataTransfer: transfer });
  expect(target).toHaveAttribute('data-drop', 'after');
  fireEvent.dragLeave(target, { relatedTarget: null });
  expect(target).not.toHaveAttribute('data-drop');
  fireEvent.dragEnd(handle);
  fireEvent.keyDown(handle, { key: ' ' });
  fireEvent.keyDown(handle, { key: 'ArrowDown' });
  expect(container.querySelector('tr[data-row-id="a"]')).toHaveAttribute('data-drop', 'after');
  fireEvent.keyDown(handle, { key: 'Escape' });
  expect(container.querySelector('[data-drop]')).toBeNull();
  expect(save).not.toHaveBeenCalled();
});
