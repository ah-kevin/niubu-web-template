import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { DataTable } from './DataTable';
import { createDataTableLabels } from './labels';
import { TreeText } from './TreeText';
import { treeSelection } from './tree-model';
import type { TreeListTableProps, RowSelectionState } from './types';

afterEach(cleanup);
type Node = { id: string; name: string; disabled?: boolean; children?: Node[] };
const roots: Node[] = [{ id: 'root', name: 'Root', children: [
  { id: 'one', name: 'One' }, { id: 'two', name: 'Two' }, { id: 'locked', name: 'Locked', disabled: true },
] }];
const getRowId = (row: Node) => row.id;
const getSubRows = (row: Node) => row.children;
const getRowLabel = (row: Node) => row.name;
const columns: TreeListTableProps<Node>['columns'] = [{ id: 'name', accessorKey: 'name', header: 'Name', cell: ctx => <em>{ctx.row.original.name}</em> }];
function Fixture({ tree, rows = roots }: { tree?: TreeListTableProps<Node>['tree']; rows?: Node[] }) {
  const { t } = useTranslation();
  return <DataTable profile="tree-list" columns={columns} caption="Tree" treeColumnId="name"
    model={{ kind: 'client', rows }} getRowId={getRowId} getSubRows={getSubRows} getRowLabel={getRowLabel}
    readState="ready" sourceCount={rows === roots ? 4 : rows.length} resultCount={rows === roots ? 4 : rows.length}
    labels={createDataTableLabels(t)} tree={tree} />;
}
const selectionLabels = { selectAll: 'All nodes', selectRow: (row: Node) => `Select ${row.name}` };
const lazyLabels = { loading: 'Loading children', error: 'Failed children', retry: 'Retry children', empty: 'No children' };

it('cascades through collapsed descendants, bubbles mixed ancestors and leaves disabled nodes untouched', () => {
  function Owner() {
    const [value, onChange] = useState<RowSelectionState>({ locked: true });
    return <Fixture tree={{ selection: { state: { kind: 'controlled', value, onChange }, isDisabled: row => !!row.disabled, labels: selectionLabels } }} />;
  }
  render(<Owner />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Root' }));
  fireEvent.click(screen.getByRole('button', { name: '展开 Root' }));
  expect(screen.getByRole('checkbox', { name: 'Select One' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Select Locked' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Select Locked' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select One' }));
  expect(screen.getByRole('checkbox', { name: 'Select Root' })).toHaveAttribute('aria-checked', 'mixed');
  fireEvent.click(screen.getByRole('checkbox', { name: 'All nodes' }));
  expect(screen.getByRole('checkbox', { name: 'Select One' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'All nodes' }));
  expect(screen.getByRole('checkbox', { name: 'Select Two' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Select Locked' })).toBeChecked();
});

it('inherits a selected parent when lazy children become available and permits deselecting a new child', () => {
  const all = treeSelection(roots, getSubRows, getRowId, { root: true }, row => !!row.disabled);
  expect(all.states.get('one')?.checked).toBe(true);
  const next = all.toggle(roots[0].children![0], false);
  const changed = treeSelection(roots, getSubRows, getRowId, next, row => !!row.disabled);
  expect(changed.states.get('root')?.mixed).toBe(true);
  expect(changed.states.get('one')?.checked).toBe(false);
  expect(changed.states.get('two')?.checked).toBe(true);
});

it('keeps matching ancestors, hides siblings, preserves custom cells and restores expansion after clearing search', () => {
  const view = render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: '展开 Root' }));
  view.rerender(<Fixture tree={{ search: { query: 'On' } }} />);
  expect(screen.getByText('On').tagName).toBe('MARK');
  expect(screen.queryByText('Two')).not.toBeInTheDocument();
  view.rerender(<Fixture />);
  expect(screen.getByText('Two').tagName).toBe('EM');
  fireEvent.click(screen.getByRole('button', { name: '收起 Root' }));
  view.rerender(<Fixture tree={{ search: { query: 'One' } }} />);
  expect(screen.getByText('One')).toBeVisible();
  view.rerender(<Fixture />);
  expect(screen.queryByText('One')).not.toBeInTheDocument();
});

it('renders markup-shaped search and labels as text', () => {
  const { container } = render(<TreeText text={'<img src=x onerror=alert(1)> <img'} query="<img" />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelectorAll('mark')).toHaveLength(2);
});

it('deduplicates repeated expansions, shows loading, retries errors, and caches empty children', async () => {
  const rows = [{ id: 'lazy', name: 'Lazy' }];
  let resolve!: (rows: Node[]) => void;
  const loadChildren = vi.fn().mockImplementationOnce(() => new Promise<Node[]>(done => { resolve = done; }))
    .mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce([]);
  const tree = { lazy: { ownerKey: 'owner', hasChildren: () => true, loadChildren, labels: lazyLabels } };
  const view = render(<Fixture rows={rows} tree={tree} />);
  fireEvent.click(screen.getByRole('button', { name: '展开 Lazy' }));
  expect(await screen.findByRole('status', { name: 'Loading children' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '收起 Lazy' }));
  fireEvent.click(screen.getByRole('button', { name: '展开 Lazy' }));
  expect(loadChildren).toHaveBeenCalledTimes(1);
  await act(async () => resolve([{ id: 'child', name: 'Child' }]));
  expect(await screen.findByText('Child')).toBeVisible();
  view.rerender(<Fixture rows={rows} tree={{ lazy: { ...tree.lazy, ownerKey: 'next' } }} />);
  fireEvent.click(screen.getByRole('button', { name: '展开 Lazy' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed children');
  fireEvent.click(screen.getByRole('button', { name: 'Retry children' }));
  expect(await screen.findByText('No children')).toBeVisible();
  expect(screen.queryByRole('button', { name: '收起 Lazy' })).not.toBeInTheDocument();
  expect(loadChildren).toHaveBeenCalledTimes(3);
});

it('aborts retired owners and unmounts; ignores late results from a loader that ignores abort', async () => {
  const requests: { signal: AbortSignal; resolve: (rows: Node[]) => void }[] = [];
  const loadChildren = vi.fn((_row: Node, { signal }: { signal: AbortSignal }) => new Promise<Node[]>(resolve => requests.push({ signal, resolve })));
  const rows = [{ id: 'lazy', name: 'Lazy' }];
  const tree = { lazy: { ownerKey: 'old', hasChildren: () => true, loadChildren, labels: lazyLabels } };
  const view = render(<Fixture rows={rows} tree={tree} />);
  fireEvent.click(screen.getByRole('button', { name: '展开 Lazy' }));
  await waitFor(() => expect(requests).toHaveLength(1));
  view.rerender(<Fixture rows={rows} tree={{ lazy: { ...tree.lazy, ownerKey: 'new' } }} />);
  expect(requests[0].signal.aborted).toBe(true);
  await act(async () => requests[0].resolve([{ id: 'stale', name: 'Stale' }]));
  expect(screen.queryByText('Stale')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '展开 Lazy' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  view.unmount();
  expect(requests[1].signal.aborted).toBe(true);
});

it('turns duplicate child IDs into retryable row errors', async () => {
  const rows = [{ id: 'lazy', name: 'Lazy' }];
  render(<Fixture rows={rows} tree={{ lazy: { ownerKey: 'bad-data', hasChildren: () => true,
    loadChildren: async () => [{ id: 'lazy', name: 'Duplicate' }], labels: lazyLabels } }} />);
  fireEvent.click(screen.getByRole('button', { name: '展开 Lazy' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed children');
  expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
});
