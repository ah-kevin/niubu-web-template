import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useTranslation } from '@niubu/locales/react';
import type { ExpandedState } from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { createDataTableLabels } from './labels';
import { createListColumnHelper } from './columns';
import type { SliceOwner, TableReadMetadata, TreeListTableProps } from './types';

type Node = { id: string; name: string; rank: number; children?: Node[] };
const leaf: Node = { id: 'leaf', name: '叶子', rank: 1 };
const branch: Node = { id: 'branch', name: 'B二', rank: 2, children: [leaf] };
const rootB: Node = { id: 'b', name: 'B组', rank: 2, children: [branch, { id: 'b-one', name: 'B一', rank: 1 }] };
const rootA: Node = { id: 'a', name: 'A组', rank: 1, children: [{ id: 'a-one', name: 'A一', rank: 1 }] };
const roots = [rootB, rootA];
const subRows = (row: Node) => row.children;
const rowLabel = (row: Node) => row.name;
const rowId = (row: Node) => row.id;
const actions = vi.fn();
const columns: TreeListTableProps<Node>['columns'] = [
  { accessorKey: 'name', id: 'name', header: '名称', cell: ctx => <em>{ctx.row.original.name}</em> },
  { accessorKey: 'rank', id: 'rank', header: '排序值', sortFn: 'basic' },
  { id: 'actions', header: '操作', cell: ctx => <button type="button" onClick={() => actions(ctx.row.original)}>编辑{ctx.row.original.name}</button> },
];
function Fixture(props: Partial<TreeListTableProps<Node>> = {}) {
  const { t } = useTranslation();
  const metadata: TableReadMetadata = props.readState && props.readState !== 'ready'
    ? { readState: props.readState, sourceCount: null, resultCount: null }
    : { readState: 'ready', sourceCount: props.sourceCount === undefined ? 6 : props.sourceCount, resultCount: props.resultCount ?? 6 };
  return <DataTable profile="tree-list" caption="层级列表" columns={columns} model={{ kind: 'client', rows: roots }} getRowId={rowId} getSubRows={subRows} getRowLabel={rowLabel} treeColumnId="name" labels={createDataTableLabels(t, { name: '名称', rank: '排序值', actions: '操作' })} {...props} {...metadata} />;
}
const ids = () => screen.getAllByRole('row').slice(1).map(row => row.getAttribute('data-row-id'));

it('defaults to collapsed native tree rows and only disclosure buttons expand three levels', async () => {
  const user = userEvent.setup(); render(<Fixture />);
  expect(ids()).toEqual(['b', 'a']);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  await user.click(screen.getByText('B组')); expect(ids()).toEqual(['b', 'a']);
  const toggle = screen.getByRole('button', { name: '展开 B组' });
  await user.click(toggle); expect(ids()).toEqual(['b', 'branch', 'b-one', 'a']);
  await user.click(screen.getByRole('button', { name: '展开 B二' }));
  expect(ids()).toEqual(['b', 'branch', 'leaf', 'b-one', 'a']);
  expect(screen.getByText('叶子').tagName).toBe('EM');
  expect(screen.queryByRole('button', { name: '展开 叶子' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '收起 B组' }));
  expect(ids()).toEqual(['b', 'a']); expect(screen.getByRole('button', { name: '展开 B组' })).toBe(toggle);
});

it('uses Enter and Space once per disclosure without firing row actions or expanding text', async () => {
  const activate = vi.fn(); const user = userEvent.setup(); actions.mockClear(); render(<Fixture onRowActivate={activate} />);
  const toggle = screen.getByRole('button', { name: '展开 B组' }); toggle.focus();
  await user.keyboard('{Enter}'); expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await user.keyboard(' '); expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(activate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '编辑B组' }));
  expect(actions).toHaveBeenCalledExactlyOnceWith(rootB); expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByText('B组')); expect(activate).toHaveBeenCalledExactlyOnceWith(rootB);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

it('sorts siblings at every level while retaining the original custom cell and row action DOM', () => {
  render(<Fixture expanded={{ kind: 'internal', initial: true }} sorting={{ kind: 'internal', initial: [{ id: 'rank', desc: true }] }} />);
  const action = screen.getByRole('button', { name: '编辑B组' });
  fireEvent.click(screen.getByRole('button', { name: '排序 排序值' }));
  expect(ids()).toEqual(['a', 'a-one', 'b', 'b-one', 'branch', 'leaf']);
  expect(screen.getByRole('button', { name: '编辑B组' })).toBe(action);
  expect(rootB.children?.[0]).toBe(branch);
});

it('routes expansion through one controlled owner and honors external expanded values', async () => {
  const change = vi.fn(); const user = userEvent.setup();
  function Owner() {
    const [expanded, setExpanded] = useState<ExpandedState>({});
    return <><Fixture expanded={{ kind: 'controlled', value: expanded, onChange: update => { change(); setExpanded(update); } }} /><button onClick={() => setExpanded(true)}>外部全部展开</button></>;
  }
  render(<Owner />);
  await user.click(screen.getByRole('button', { name: '展开 B组' }));
  expect(change).toHaveBeenCalledOnce(); expect(ids()).toEqual(['b', 'branch', 'b-one', 'a']);
  await user.click(screen.getByRole('button', { name: '外部全部展开' }));
  expect(change).toHaveBeenCalledOnce(); expect(ids()).toEqual(['b', 'branch', 'leaf', 'b-one', 'a', 'a-one']);
});

it('retains internal expansion and surviving row buttons when full data is refreshed', async () => {
  const view = render(<Fixture expanded={{ kind: 'internal', initial: { b: true } }} />);
  const action = screen.getByRole('button', { name: '编辑B二' });
  view.rerender(<Fixture model={{ kind: 'client', rows: [...roots] }} expanded={{ kind: 'internal', initial: { b: true } }} />);
  await act(async () => {});
  expect(screen.getByRole('button', { name: '收起 B组' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: '编辑B二' })).toBe(action);
});

it('keeps tree cells in shared pin/resize/settings ownership and protects the hierarchy column', async () => {
  const user = userEvent.setup(); render(<Fixture expanded={{ kind: 'internal', initial: true }} />);
  await user.click(screen.getByRole('button', { name: '显示设置' }));
  const settings = within(screen.getByRole('dialog', { name: '显示设置' }));
  expect(settings.getByRole('checkbox', { name: '显示 名称' })).toBeDisabled();
  await user.click(settings.getByRole('button', { name: '固定 名称 固定到开头' }));
  expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ insetInlineStart: '0px' });
  await user.click(settings.getByRole('button', { name: '更多列设置' }));
  const width = settings.getByRole('spinbutton', { name: '名称 列宽' });
  fireEvent.change(width, { target: { value: '260' } }); fireEvent.blur(width);
  expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ width: '260px' });
  expect(screen.getByText('叶子').tagName).toBe('EM');
});

it('shares toolbar/maximize/popover without replacing the tree or creating a pager', async () => {
  const user = userEvent.setup(); render(<Fixture toolbar={{ allowMaximize: true }} />);
  const table = screen.getByRole('table'); const action = screen.getByRole('button', { name: '编辑B组' });
  await user.click(screen.getByRole('button', { name: '全屏' }));
  await user.click(screen.getByRole('button', { name: '显示设置' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '退出全屏' })).toBeVisible();
  await waitFor(() => expect(screen.getByRole('button', { name: '显示设置' })).toHaveFocus());
  await user.keyboard('{Escape}');
  expect(screen.getByRole('table')).toBe(table); expect(screen.getByRole('button', { name: '编辑B组' })).toBe(action);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it.each(['controlled', 'internal'] as const)('rejects a hidden hierarchy column without changing its %s owner', kind => {
  const change = vi.fn();
  const owner = kind === 'controlled' ? { kind, value: { name: false }, onChange: change } : { kind, initial: { name: false } };
  expect(() => render(<Fixture columnVisibility={owner} />)).toThrow(/tree column.*visible/i);
  expect(change).not.toHaveBeenCalled();
});

it('rejects missing or grouped hierarchy columns', () => {
  expect(() => render(<Fixture treeColumnId="missing" />)).toThrow(/tree column.*leaf/i);
  expect(() => render(<Fixture treeColumnId="group" columns={[{ id: 'group', header: '分组', columns }]} />)).toThrow(/tree column.*leaf/i);
});

it('validates IDs across every descendant and rejects cycles before native recursion', () => {
  const duplicate: Node = { ...rootB, children: [{ ...leaf, id: 'a' }] };
  expect(() => render(<Fixture model={{ kind: 'client', rows: [duplicate, rootA] }} />)).toThrow(/duplicate/i);
  const empty: Node = { ...rootB, children: [{ ...leaf, id: '' }] };
  expect(() => render(<Fixture model={{ kind: 'client', rows: [empty] }} />)).toThrow(/empty/i);
  const cycle: Node = { id: 'cycle', name: '环', rank: 0 }; cycle.children = [cycle];
  expect(() => render(<Fixture model={{ kind: 'client', rows: [cycle] }} />)).toThrow(/cycle/i);
});

it('counts the full hierarchy and preserves non-ready metadata rules', () => {
  expect(() => render(<Fixture sourceCount={2} resultCount={2} />)).toThrow(/complete.*tree|tree.*count/i);
  expect(() => render(<Fixture sourceCount={5} resultCount={6} />)).toThrow(/exceeds/i);
  expect(() => render(<Fixture readState="pending" sourceCount={null} resultCount={null} />)).toThrow(/non-ready/i);
});

it.each([{ invalid: false }, { invalid: [] }, { invalid: { b: 1 } }])('rejects malformed expanded state $invalid', ({ invalid }) => {
  const expanded: SliceOwner<ExpandedState> = { kind: 'internal', initial: {} };
  Reflect.set(expanded, 'initial', invalid);
  expect(() => render(<Fixture expanded={expanded} />)).toThrow(/expanded/i);
});

it('retains controlled expansion through pending, filtered snapshots and restoration without owner callbacks', async () => {
  const change = vi.fn();
  const expanded: SliceOwner<ExpandedState> = { kind: 'controlled', value: { b: true, 'not-in-filter': true }, onChange: change };
  const view = render(<Fixture expanded={expanded} />);
  expect(ids()).toEqual(['b', 'branch', 'b-one', 'a']);
  view.rerender(<Fixture expanded={expanded} model={{ kind: 'client', rows: [] }} readState="pending" sourceCount={null} resultCount={null} />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  view.rerender(<Fixture expanded={expanded} model={{ kind: 'client', rows: [rootA] }} sourceCount={6} resultCount={2} />);
  expect(ids()).toEqual(['a']);
  view.rerender(<Fixture expanded={expanded} />);
  await act(async () => {});
  expect(ids()).toEqual(['b', 'branch', 'b-one', 'a']); expect(change).not.toHaveBeenCalled();
});

it('updates structure from a changed getSubRows lookup without replacing original DTO rows', () => {
  const structuralRoots = [rootB];
  const lookup = (row: Node) => row === rootB ? [branch] : row === branch ? [leaf] : undefined;
  const view = render(<Fixture model={{ kind: 'client', rows: structuralRoots }} getSubRows={lookup} sourceCount={3} resultCount={3} expanded={{ kind: 'internal', initial: true }} />);
  expect(ids()).toEqual(['b', 'branch', 'leaf']);
  const action = screen.getByRole('button', { name: '编辑B组' });
  const nextLookup = (row: Node) => row === rootB ? [leaf] : undefined;
  view.rerender(<Fixture model={{ kind: 'client', rows: structuralRoots }} getSubRows={nextLookup} sourceCount={2} resultCount={2} expanded={{ kind: 'internal', initial: true }} />);
  expect(ids()).toEqual(['b', 'leaf']); expect(screen.getByRole('button', { name: '编辑B组' })).toBe(action);
  actions.mockClear(); fireEvent.click(action); expect(actions).toHaveBeenCalledExactlyOnceWith(rootB);
});

it('rejects unsafe expanded keys but permits false and unknown safe IDs', () => {
  const unsafe: SliceOwner<ExpandedState> = { kind: 'internal', initial: Object.fromEntries([['__proto__', true]]) };
  expect(() => render(<Fixture expanded={unsafe} />)).toThrow(/expanded/i);
  render(<Fixture expanded={{ kind: 'internal', initial: { b: false, 'retired-row': true } }} />);
  expect(ids()).toEqual(['b', 'a']);
});

it('preserves an existing list page-size option across pending footer unmounts', async () => {
  const helper = createListColumnHelper<Node>(); const legacyColumns = helper.columns([helper.accessor('name', { id: 'name', header: '名称' })]);
  function Legacy({ pending = false }: { pending?: boolean }) {
    const { t } = useTranslation(); const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 2 });
    return <DataTable profile="list" caption="原列表" columns={legacyColumns} getRowId={rowId} labels={createDataTableLabels(t)} model={{ kind: 'server', rows: pending ? [] : roots, rowCount: pending ? 0 : 6 }} pagination={{ kind: 'controlled', value: pagination, onChange: setPagination }} {...(pending ? { readState: 'pending', sourceCount: null, resultCount: null } : { readState: 'ready', sourceCount: 6, resultCount: 6 })} />;
  }
  const view = render(<Legacy />);
  const size = screen.getByRole('combobox', { name: '每页条数' }); size.focus(); fireEvent.keyDown(size, { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: '20 条/页' }), { key: 'Enter' });
  view.rerender(<Legacy pending />); view.rerender(<Legacy />);
  const restored = screen.getByRole('combobox', { name: '每页条数' }); restored.focus(); fireEvent.keyDown(restored, { key: 'ArrowDown' });
  expect(await screen.findByRole('option', { name: '2 条/页' })).toBeVisible();
});

it('rejects a malformed controlled expansion owner without committing a fallback', () => {
  const change = vi.fn(); const expanded: SliceOwner<ExpandedState> = { kind: 'controlled', value: {}, onChange: change };
  Reflect.set(expanded, 'value', { b: 'yes' });
  expect(() => render(<Fixture expanded={expanded} />)).toThrow(/expanded/i);
  expect(change).not.toHaveBeenCalled();
});

it('rejects runtime server models and pagination instead of silently treating them as trees', () => {
  const paginated: Partial<TreeListTableProps<Node>> = {};
  Reflect.set(paginated, 'pagination', { kind: 'internal', initial: { pageIndex: 0, pageSize: 10 } });
  expect(() => render(<Fixture {...paginated} />)).toThrow(/tree.*pagination/i);
  const model = { kind: 'client' as const, rows: roots };
  Reflect.set(model, 'kind', 'server'); Reflect.set(model, 'rowCount', 6);
  expect(() => render(<Fixture model={model} />)).toThrow(/complete client/i);
});
