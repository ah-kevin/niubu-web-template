import { memo, useState } from 'react';
import { Subscribe, type Row } from '@tanstack/react-table';
import { selectableListFeatures } from './profiles';
import { fireEvent, render, screen, within, act } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import { createListColumnHelper, createReadColumnHelper, createSelectableColumnHelper } from './columns';
import { validateRowIds } from './identity';
import type { TableLabels } from './types';

const labels: TableLabels = {
  pending: '读取中',
  error: '读取失败',
  sourceEmpty: '暂无来源记录',
  sourceUnknown: '来源总数未知',
  filteredEmpty: '没有匹配记录',
  pageEmpty: '当前页没有记录',
  previousPage: '上一页',
  nextPage: '下一页',
  pageSize: '每页条数',
  settings: '列设置',
  resetColumns: '重置列',
  pinStart: '起始侧',
  pinEnd: '结束侧',
  unpin: '不固定',
  columnName: id => id,
  showColumn: id => `显示 ${id}`,
  columnWidth: id => `${id} 列宽`,
  resizeColumn: id => `调整 ${id} 列宽`,
  pinColumn: id => `固定 ${id}`,
  sortColumn: id => `按 ${id} 排序`,
  page: (page, count) => `第 ${page} / ${count} 页`,
  total: count => `共 ${count} 条`,
};
const h = createListColumnHelper<{ id: string; quantity: number | null }>();
const columns = h.columns([
  h.accessor('id', { id: 'id', header: 'ID', sortFn: 'alphanumeric' }),
  h.accessor(row => row.quantity ?? undefined, {
    id: 'quantity',
    header: '数量',
    sortFn: 'basic',
    sortUndefined: 'last',
    cell: ctx => (ctx.getValue() === undefined ? '未知' : String(ctx.getValue())),
  }),
]);
const rows = [
  { id: 'two', quantity: 2 },
  { id: 'unknown', quantity: null },
  { id: 'zero', quantity: 0 },
  { id: 'ten', quantity: 10 },
];
const base = {
  columns,
  getRowId: (row: (typeof rows)[number]) => row.id,
  caption: '库存',
  labels,
  readState: 'ready',
  sourceCount: 4,
  resultCount: 4,
} as const;
const renderedIds = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map(row => row.getAttribute('data-row-id'));
it('sorts numeric values once with unknown last in both directions and keeps original facts', () => {
  render(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows }}
      sorting={{ kind: 'internal', initial: [{ id: 'quantity', desc: false }] }}
    />,
  );
  expect(renderedIds()).toEqual(['zero', 'two', 'ten', 'unknown']);
  fireEvent.click(screen.getByRole('button', { name: '按 quantity 排序' }));
  expect(renderedIds()).toEqual(['ten', 'two', 'zero', 'unknown']);
  expect(rows[1].quantity).toBeNull();
});
it('does not sort or paginate the current server page again or reset controlled page', () => {
  const change = vi.fn();
  render(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'server', rows: rows.slice(0, 2), rowCount: 40 }}
      sourceCount={50}
      resultCount={40}
      sorting={{ kind: 'internal', initial: [{ id: 'quantity', desc: true }] }}
      pagination={{ kind: 'controlled', value: { pageIndex: 3, pageSize: 10 }, onChange: change }}
    />,
  );
  expect(renderedIds()).toEqual(['two', 'unknown']);
  expect(change).not.toHaveBeenCalled();
});
it('forwards a controlled sort update exactly once', () => {
  const change = vi.fn();
  render(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows }}
      sorting={{ kind: 'controlled', value: [], onChange: change }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '按 quantity 排序' }));
  expect(change).toHaveBeenCalledTimes(1);
});
it('replaces rows without retaining old row IDs', () => {
  const view = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} />);
  view.rerender(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows: [{ id: 'replacement', quantity: 9 }] }}
      resultCount={1}
    />,
  );
  expect(renderedIds()).toEqual(['replacement']);
  expect(screen.queryByText('two')).not.toBeInTheDocument();
});
it('rejects empty and duplicate source identities', () => {
  expect(() => validateRowIds([{ id: '' }], row => row.id)).toThrow(/empty/);
  expect(() => validateRowIds([{ id: 'same' }, { id: 'same' }], row => row.id)).toThrow(/duplicate/);
});
it('distinguishes unknown source, filtered zero, known source empty, and empty current page', () => {
  const view = render(
    <DataTable {...base} profile="list" model={{ kind: 'client', rows: [] }} sourceCount={null} resultCount={0} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('来源总数未知');
  view.rerender(<DataTable {...base} profile="list" model={{ kind: 'client', rows: [] }} resultCount={0} />);
  expect(screen.getByRole('status')).toHaveTextContent('没有匹配记录');
  view.rerender(
    <DataTable {...base} profile="list" model={{ kind: 'client', rows: [] }} sourceCount={0} resultCount={0} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('暂无来源记录');
  view.rerender(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'server', rows: [], rowCount: 4 }}
      pagination={{ kind: 'internal', initial: { pageIndex: 8, pageSize: 25 } }}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('当前页没有记录');
});
it('read cells render native accessor content and escape HTML', () => {
  const read = createReadColumnHelper<{ id: string }>();
  render(
    <DataTable
      profile="read"
      model={{ kind: 'client', rows: [{ id: '<img src=x onerror=alert(1)>' }] }}
      columns={read.columns([read.accessor('id', { id: 'id', header: '记录' })])}
      getRowId={row => row.id}
      caption="只读"
      labels={labels}
      readState="ready"
      sourceCount={1}
      resultCount={1}
    />,
  );
  expect(within(screen.getByRole('table')).getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('retains the controller page after client sorting and replacing the complete result', async () => {
  const change = vi.fn();
  const more = Array.from({ length: 30 }, (_, i) => ({ id: `real-${i}`, quantity: i }));
  const view = render(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows: more }}
      sourceCount={30}
      resultCount={30}
      pagination={{ kind: 'controlled', value: { pageIndex: 1, pageSize: 25 }, onChange: change }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '按 quantity 排序' }));
  await act(async () => {});
  expect(change).not.toHaveBeenCalled();
  expect(renderedIds()).toHaveLength(5);
  view.rerender(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows: more.slice(0, 2) }}
      resultCount={2}
      pagination={{ kind: 'controlled', value: { pageIndex: 1, pageSize: 25 }, onChange: change }}
    />,
  );
  await act(async () => {});
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('当前页没有记录');
});
it('renders pending and error explicitly and rejects contradictory counts or row identity', () => {
  const view = render(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows: [] }}
      readState="pending"
      sourceCount={null}
      resultCount={null}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('读取中');
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  view.rerender(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows: [] }}
      readState="error"
      sourceCount={null}
      resultCount={null}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('读取失败');
  expect(() => render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} resultCount={0} />)).toThrow(
    /complete/,
  );
  expect(() => render(<DataTable {...base} profile="list" model={{ kind: 'server', rows, rowCount: NaN }} />)).toThrow(
    /rowCount/,
  );
  expect(() =>
    render(<DataTable {...base} profile="list" model={{ kind: 'client', rows: [rows[0], rows[0]] }} resultCount={2} />),
  ).toThrow(/duplicate/);
});
it('keeps semantic native controls and labels from activating a row, but preserves exact original row activation', () => {
  const activate = vi.fn();
  const change = vi.fn();
  const rh = createReadColumnHelper<{ id: string }>();
  const original = { id: 'source-real' };
  const defs = rh.columns([
    rh.display({
      id: 'actions',
      header: '动作',
      cell: () => (
        <>
          <span>普通内容</span>
          <input type="checkbox" id="row-check" onChange={change} />
          <label htmlFor="row-check">
            关联选择<span>嵌套标签</span>
          </label>
          <label>
            内含选择
            <input type="checkbox" onChange={change} />
          </label>
          <button>真实按钮</button>
          <a href="#detail">真实链接</a>
          <select aria-label="真实下拉">
            <option>选项</option>
          </select>
          <textarea aria-label="真实输入" />
          <span data-row-action>
            自定义动作<span>嵌套动作</span>
          </span>
        </>
      ),
    }),
  ]);
  render(
    <DataTable
      profile="read"
      columns={defs}
      model={{ kind: 'client', rows: [original] }}
      getRowId={row => row.id}
      labels={labels}
      caption="边界"
      readState="ready"
      sourceCount={1}
      resultCount={1}
      onRowActivate={activate}
    />,
  );
  for (const text of ['嵌套标签', '内含选择', '真实按钮', '真实链接', '嵌套动作'])
    fireEvent.click(screen.getByText(text));
  fireEvent.click(screen.getByLabelText('真实下拉'));
  fireEvent.click(screen.getByLabelText('真实输入'));
  expect(activate).not.toHaveBeenCalled();
  expect(change).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('普通内容'));
  const row = screen.getByText('普通内容').closest('tr')!;
  row.focus();
  fireEvent.keyDown(row, { key: 'Enter' });
  expect(activate).toHaveBeenNthCalledWith(1, original);
  expect(activate).toHaveBeenNthCalledWith(2, original);
  expect(row).toHaveFocus();
});
it('keeps header and body in logical pin order with matching offsets and widths, and never hides the last column', () => {
  render(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows }}
      columnPinning={{ kind: 'internal', initial: { start: ['quantity'], end: ['id'] } }}
    />,
  );
  expect(screen.getAllByRole('columnheader').map(el => el.textContent)).toEqual(['数量', 'ID']);
  const first = screen.getAllByRole('row')[1];
  const cells = within(first).getAllByRole('cell');
  expect(cells.map(el => el.textContent)).toEqual(['2', 'two']);
  expect(screen.getAllByRole('columnheader')[0].style.insetInlineStart).toBe('0px');
  expect(cells[0].style.width).toBe('180px');
  expect(cells[1].style.insetInlineEnd).toBe('0px');
  fireEvent.click(screen.getByText('列设置'));
  fireEvent.click(screen.getByRole('checkbox', { name: '显示 id' }));
  expect(screen.getAllByRole('columnheader')).toHaveLength(1);
  expect(screen.getByRole('checkbox', { name: '显示 quantity' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '重置列' }));
  expect(screen.getAllByRole('columnheader')).toHaveLength(2);
});
it('connects keyboard, numeric and native mouse resize with widths clamped to 80 through 640', () => {
  render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} />);
  fireEvent.click(screen.getByText('列设置'));
  const resizer = screen.getByRole('button', { name: '调整 id 列宽' });
  const width = () => screen.getByRole('spinbutton', { name: 'id 列宽' });
  fireEvent.keyDown(resizer, { key: 'ArrowRight' });
  expect(width()).toHaveValue(190);
  fireEvent.change(width(), { target: { value: '999' } });
  fireEvent.blur(width());
  expect(width()).toHaveValue(640);
  fireEvent.keyDown(resizer, { key: 'ArrowRight' });
  expect(width()).toHaveValue(640);
  fireEvent.change(width(), { target: { value: '1' } });
  fireEvent.blur(width());
  expect(width()).toHaveValue(80);
  fireEvent.mouseDown(resizer, { clientX: 100 });
  fireEvent.mouseMove(document, { clientX: 160 });
  fireEvent.mouseUp(document, { clientX: 160 });
  expect(width()).toHaveValue(140);
});
it('rejects all-hidden controlled state and invalid column widths at the renderer boundary', () => {
  expect(() =>
    render(
      <DataTable
        {...base}
        profile="list"
        model={{ kind: 'client', rows }}
        columnVisibility={{ kind: 'controlled', value: { id: false, quantity: false }, onChange: () => {} }}
      />,
    ),
  ).toThrow(/visible/);
  expect(() =>
    render(
      <DataTable
        {...base}
        profile="list"
        model={{ kind: 'client', rows }}
        columnSizing={{ kind: 'internal', initial: { id: 900 } }}
      />,
    ),
  ).toThrow(/width/);
});
it('keeps selection reactive through memo cells and core-context Subscribe, preserving unloaded IDs and deleting deselection keys', () => {
  const sh = createSelectableColumnHelper<{ id: string }>();
  const Selected = memo(function Selected({ row }: { row: Row<typeof selectableListFeatures, { id: string }> }) {
    return (
      <Subscribe source={row.table.atoms.rowSelection} selector={state => state[row.id]}>
        {selected => <span>{selected ? '已选事实' : '未选事实'}</span>}
      </Subscribe>
    );
  });
  const defs = sh.columns([
    sh.accessor('id', { id: 'id', header: 'ID' }),
    sh.display({ id: 'selected', header: '选择状态', cell: ctx => <Selected row={ctx.row} /> }),
  ]);
  const onChange = vi.fn();
  function Controlled() {
    const [selected, setSelected] = useState<Record<string, true>>({ unloaded: true });
    return (
      <DataTable
        profile="selectable-list"
        model={{ kind: 'server', rows: [{ id: 'loaded' }], rowCount: 2 }}
        columns={defs}
        getRowId={row => row.id}
        caption="选择"
        labels={labels}
        readState="ready"
        sourceCount={2}
        resultCount={2}
        rowSelection={{
          kind: 'controlled',
          value: selected,
          onChange: updater => {
            onChange(updater);
            setSelected(updater);
          },
        }}
        selectionLabels={{
          selectPage: '选择当前页',
          selectRow: id => `选择 ${id}`,
          selected: count => `已选 ${count}`,
          selectAllResults: count => `选择全部 ${count} 条结果`,
          clearSelection: '清除选择',
          allResultsUnavailable: '暂不支持选择全部结果',
        }}
      />
    );
  }
  render(<Controlled />);
  const checkbox = () => screen.getByRole('checkbox', { name: '选择 loaded' });
  expect(screen.getByText('未选事实')).toBeVisible();
  fireEvent.click(checkbox());
  expect(checkbox()).toBeChecked();
  expect(screen.getByText('已选事实')).toBeVisible();
  expect(screen.getByText('已选 2')).toBeVisible();
  expect(onChange).toHaveBeenCalledTimes(1);
  fireEvent.click(checkbox());
  expect(checkbox()).not.toBeChecked();
  expect(screen.getByText('未选事实')).toBeVisible();
  expect(screen.getByText('已选 1')).toBeVisible();
  const updater = onChange.mock.calls[1][0];
  expect(updater({ loaded: true, unloaded: true })).toEqual({ unloaded: true });
});
it('replaces a slice owner without retaining the previous controlled callback', () => {
  const change = vi.fn();
  const view = render(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows }}
      sorting={{ kind: 'controlled', value: [{ id: 'quantity', desc: false }], onChange: change }}
    />,
  );
  view.rerender(
    <DataTable
      {...base}
      profile="list"
      model={{ kind: 'client', rows }}
      sorting={{ kind: 'internal', initial: [{ id: 'quantity', desc: false }] }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '按 quantity 排序' }));
  expect(change).not.toHaveBeenCalled();
  expect(renderedIds()).toEqual(['ten', 'two', 'zero', 'unknown']);
});
it('enforces width bounds on native column definitions instead of letting a column override global bounds', () => {
  const defs = h.columns([h.accessor('id', { id: 'id', header: 'ID', maxSize: 900 })]);
  expect(() => render(<DataTable {...base} columns={defs} profile="list" model={{ kind: 'client', rows }} />)).toThrow(
    /width/,
  );
});
it('renders fresh translated labels and accessors without changing source IDs or numeric facts', () => {
  const view = render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} />);
  const translated = {
    ...labels,
    nextPage: 'Next page',
    columnName: (id: string) => (id === 'quantity' ? 'Quantity' : id),
    sortColumn: (name: string) => `Sort ${name}`,
  };
  const translatedColumns = h.columns([
    h.accessor('id', { id: 'id', header: 'ID', sortFn: 'alphanumeric' }),
    h.accessor(row => row.quantity ?? undefined, {
      id: 'quantity',
      header: 'Quantity',
      sortFn: 'basic',
      sortUndefined: 'last',
      cell: ctx => (ctx.getValue() === undefined ? 'Unknown' : `${ctx.getValue()} kg`),
    }),
  ]);
  view.rerender(
    <DataTable
      {...base}
      columns={translatedColumns}
      labels={translated}
      profile="list"
      model={{ kind: 'client', rows }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Sort Quantity' })).toBeVisible();
  expect(screen.getByText('10 kg')).toBeVisible();
  expect(renderedIds()).toEqual(['two', 'unknown', 'zero', 'ten']);
  expect(rows[1].quantity).toBeNull();
});
it('selects the client page or the complete current result explicitly and clears an initial selection', () => {
  const sh = createSelectableColumnHelper<{ id: string }>();
  const defs = sh.columns([sh.accessor('id', { id: 'id', header: 'ID' })]);
  const complete = Array.from({ length: 60 }, (_, i) => ({ id: `order-${i + 1}` }));
  render(
    <DataTable
      profile="selectable-list"
      columns={defs}
      model={{ kind: 'client', rows: complete }}
      getRowId={row => row.id}
      caption="订单"
      labels={labels}
      readState="ready"
      sourceCount={60}
      resultCount={60}
      rowSelection={{ kind: 'internal', initial: { 'order-60': true } }}
      selectionLabels={{
        selectPage: '选择当前页',
        selectRow: id => `选择 ${id}`,
        selected: count => `已选 ${count}`,
        selectAllResults: count => `选择全部 ${count} 条结果`,
        clearSelection: '清除选择',
        allResultsUnavailable: '暂不支持选择全部结果',
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '清除选择' }));
  expect(screen.getByText('已选 0')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: '选择当前页' }));
  expect(screen.getByText('已选 25')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '选择全部 60 条结果' }));
  expect(screen.getByText('已选 60')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '清除选择' }));
  expect(screen.getByText('已选 0')).toBeVisible();
});
it('server all-results selection calls only the explicit controller and stays disabled without that capability', () => {
  const sh = createSelectableColumnHelper<{ id: string }>();
  const defs = sh.columns([sh.accessor('id', { id: 'id', header: 'ID' })]);
  const select = vi.fn();
  const all = vi.fn();
  const props = {
    profile: 'selectable-list',
    columns: defs,
    model: { kind: 'server', rows: [{ id: 'order-26' }], rowCount: 60 },
    getRowId: (row: { id: string }) => row.id,
    caption: '订单',
    labels,
    readState: 'ready',
    sourceCount: 60,
    resultCount: 60,
    rowSelection: { kind: 'controlled', value: {}, onChange: select },
    selectionLabels: {
      selectPage: '选择当前页',
      selectRow: (id: string) => `选择 ${id}`,
      selected: (count: number) => `已选 ${count}`,
      selectAllResults: (count: number) => `选择全部 ${count} 条结果`,
      clearSelection: '清除选择',
      allResultsUnavailable: '暂不支持选择全部结果',
    },
  } as const;
  const view = render(<DataTable {...props} onSelectAllResults={all} />);
  fireEvent.click(screen.getByRole('button', { name: '选择全部 60 条结果' }));
  expect(all).toHaveBeenCalledTimes(1);
  expect(select).not.toHaveBeenCalled();
  view.rerender(<DataTable {...props} />);
  expect(screen.getByRole('button', { name: '选择全部 60 条结果' })).toBeDisabled();
  expect(screen.getByText('暂不支持选择全部结果')).toBeVisible();
});
it('starts an internally owned selection empty when no initial value is supplied', () => {
  const sh = createSelectableColumnHelper<{ id: string }>();
  render(
    <DataTable
      profile="selectable-list"
      columns={sh.columns([sh.accessor('id', { id: 'id', header: 'ID' })])}
      model={{ kind: 'client', rows: [{ id: 'record' }] }}
      getRowId={row => row.id}
      caption="初始选择"
      labels={labels}
      readState="ready"
      sourceCount={1}
      resultCount={1}
      rowSelection={{ kind: 'internal' }}
      selectionLabels={{
        selectPage: '选择当前页',
        selectRow: id => `选择 ${id}`,
        selected: count => `已选 ${count}`,
        selectAllResults: count => `全部 ${count}`,
        clearSelection: '清除选择',
        allResultsUnavailable: '暂不支持选择全部结果',
      }}
    />,
  );
  expect(screen.getByText('已选 0')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: '选择 record' }));
  expect(screen.getByText('已选 1')).toBeVisible();
});
it('shows mixed page selection on the shared checkbox and keeps row clicks separate from selection', () => {
  const sh = createSelectableColumnHelper<{ id: string }>();
  const activate = vi.fn();
  render(
    <DataTable
      profile="selectable-list"
      columns={sh.columns([sh.accessor('id', { id: 'id', header: 'ID' })])}
      model={{ kind: 'client', rows: [{ id: 'one' }, { id: 'two' }] }}
      getRowId={row => row.id}
      caption="选择边界"
      labels={labels}
      readState="ready"
      sourceCount={2}
      resultCount={2}
      onRowActivate={activate}
      rowSelection={{ kind: 'internal', initial: { one: true } }}
      selectionLabels={{
        selectPage: '选择当前页',
        selectRow: id => `选择 ${id}`,
        selected: count => `已选 ${count}`,
        selectAllResults: count => `全部 ${count}`,
        clearSelection: '清除选择',
        allResultsUnavailable: '暂不支持选择全部结果',
      }}
    />,
  );
  const page = screen.getByRole('checkbox', { name: '选择当前页' });
  expect(page).toHaveAttribute('aria-checked', 'mixed');
  expect(page).toHaveAttribute('data-state', 'indeterminate');
  fireEvent.click(screen.getByRole('checkbox', { name: '选择 two' }));
  expect(activate).not.toHaveBeenCalled();
  expect(page).toHaveAttribute('data-state', 'checked');
});
it('sizes a native grouped header to its visible child widths', () => {
  render(
    <DataTable
      {...base}
      profile="list"
      columns={h.columns([h.group({ id: 'facts', header: '事实', columns })])}
      model={{ kind: 'client', rows }}
    />,
  );
  expect(screen.getByRole('columnheader', { name: '事实' })).toHaveStyle({ width: '360px' });
});

it('rejects accessor keys that collide after native dotted-key normalization', () => {
  const helper = createListColumnHelper<{ id: string; nested: { value: string }; nested_value: string }>();
  const collision = helper.columns([
    helper.accessor('nested.value', { header: 'Nested' }),
    helper.accessor('nested_value', { header: 'Top level' }),
  ]);
  expect(() =>
    render(
      <DataTable
        profile="list"
        columns={collision}
        model={{
          kind: 'client',
          rows: [{ id: 'source', nested: { value: 'nested fact' }, nested_value: 'top-level fact' }],
        }}
        getRowId={row => row.id}
        caption="事实"
        labels={labels}
        readState="ready"
        sourceCount={1}
        resultCount={1}
      />,
    ),
  ).toThrow(/Column ID/);
});
it('preserves both facts when dotted and underscored accessors have explicit distinct native IDs', () => {
  const helper = createListColumnHelper<{ id: string; nested: { value: string }; nested_value: string }>();
  const columns = helper.columns([
    helper.accessor('nested.value', { id: 'nested-fact', header: 'Nested' }),
    helper.accessor('nested_value', { id: 'top-level-fact', header: 'Top level' }),
  ]);
  render(
    <DataTable
      profile="list"
      columns={columns}
      model={{
        kind: 'client',
        rows: [{ id: 'source', nested: { value: 'nested fact' }, nested_value: 'top-level fact' }],
      }}
      getRowId={row => row.id}
      caption="事实"
      labels={labels}
      readState="ready"
      sourceCount={1}
      resultCount={1}
    />,
  );
  expect(
    within(screen.getAllByRole('row')[1])
      .getAllByRole('cell')
      .map(cell => cell.textContent),
  ).toEqual(['nested fact', 'top-level fact']);
});
for (const profile of ['list', 'selectable-list'] as const)
  for (const gesture of ['mouse', 'touch'] as const)
    for (const [end, width] of [
      [720, 640],
      [-720, 80],
    ] as const)
      it(`${profile} controlled ${gesture} resize to ${end} keeps owner width ${width} with one callback per native update`, () => {
        const change = vi.fn();
        const helper = createSelectableColumnHelper<{ id: string }>();
        const selectableColumns = helper.columns([helper.accessor('id', { id: 'id', header: 'ID' })]);
        const listHelper = createListColumnHelper<{ id: string }>();
        const listColumns = listHelper.columns([listHelper.accessor('id', { id: 'id', header: 'ID' })]);
        function Controlled() {
          const [sizing, setSizing] = useState<Record<string, number>>({});
          const owner = {
            kind: 'controlled' as const,
            value: sizing,
            onChange: (updater: import('./types').Updater<Record<string, number>>) => {
              change(updater);
              setSizing(updater);
            },
          };
          const shared = {
            model: { kind: 'client' as const, rows: [{ id: 'record' }] },
            getRowId: (row: { id: string }) => row.id,
            caption: 'resize',
            labels,
            readState: 'ready' as const,
            sourceCount: 1,
            resultCount: 1,
            columnSizing: owner,
          };
          return (
            <>
              <output aria-label="owner widths">{JSON.stringify(sizing)}</output>
              {profile === 'list' ? (
                <DataTable {...shared} profile="list" columns={listColumns} />
              ) : (
                <DataTable
                  {...shared}
                  profile="selectable-list"
                  columns={selectableColumns}
                  rowSelection={{ kind: 'internal' }}
                  selectionLabels={{
                    selectPage: '选择当前页',
                    selectRow: id => `选择 ${id}`,
                    selected: count => `已选 ${count}`,
                    selectAllResults: count => `全部 ${count}`,
                    clearSelection: '清除选择',
                    allResultsUnavailable: '暂不支持选择全部结果',
                  }}
                />
              )}
            </>
          );
        }
        render(<Controlled />);
        const resizer = screen.getByRole('button', { name: '调整 id 列宽' });
        if (gesture === 'mouse') {
          fireEvent.mouseDown(resizer, { clientX: 0 });
          fireEvent.mouseUp(document, { clientX: end });
        } else {
          fireEvent.touchStart(resizer, { touches: [{ clientX: 0 }] });
          fireEvent.touchMove(document, { touches: [{ clientX: end }] });
          fireEvent.touchEnd(document, { touches: [] });
        }
        expect(screen.getByLabelText('owner widths')).toHaveTextContent(JSON.stringify({ id: width }));
        expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveStyle({ width: `${width}px` });
        expect(change).toHaveBeenCalledTimes(gesture === 'mouse' ? 1 : 2);
      });
for (const ownership of ['internal', 'controlled'] as const)
  it(`${ownership} grouped keyboard resize writes bounded leaf widths and changes visible facts width`, () => {
    const change = vi.fn();
    function Group() {
      const [sizing, setSizing] = useState<Record<string, number>>({});
      const owner =
        ownership === 'internal'
          ? { kind: 'internal' as const }
          : {
              kind: 'controlled' as const,
              value: sizing,
              onChange: (updater: import('./types').Updater<Record<string, number>>) => {
                change(updater);
                setSizing(updater);
              },
            };
      return (
        <>
          <output aria-label="group owner widths">{JSON.stringify(sizing)}</output>
          <DataTable
            {...base}
            profile="list"
            columns={h.columns([h.group({ id: 'facts', header: '事实', columns })])}
            model={{ kind: 'client', rows }}
            columnSizing={owner}
          />
        </>
      );
    }
    render(<Group />);
    fireEvent.keyDown(screen.getByRole('button', { name: '调整 facts 列宽' }), { key: 'ArrowRight' });
    expect(screen.getByRole('columnheader', { name: '事实' })).toHaveStyle({ width: '380px' });
    expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveStyle({ width: '190px' });
    if (ownership === 'controlled') {
      expect(screen.getByLabelText('group owner widths')).toHaveTextContent('{"id":190,"quantity":190}');
      expect(change).toHaveBeenCalledTimes(1);
    }
  });
it('controlled native group drag returns only leaf IDs despite the SDK descendant list including the group', () => {
  const change = vi.fn();
  function GroupDrag() {
    const [sizing, setSizing] = useState<Record<string, number>>({});
    return (
      <>
        <output aria-label="group drag widths">{JSON.stringify(sizing)}</output>
        <DataTable
          {...base}
          profile="list"
          columns={h.columns([h.group({ id: 'facts', header: '事实', columns })])}
          model={{ kind: 'client', rows }}
          columnSizing={{
            kind: 'controlled',
            value: sizing,
            onChange: updater => {
              change(updater);
              setSizing(updater);
            },
          }}
        />
      </>
    );
  }
  render(<GroupDrag />);
  fireEvent.mouseDown(screen.getByRole('button', { name: '调整 facts 列宽' }), { clientX: 0 });
  fireEvent.mouseUp(document, { clientX: 2000 });
  expect(screen.getByLabelText('group drag widths')).toHaveTextContent('{"id":640,"quantity":640}');
  expect(screen.getByRole('columnheader', { name: '事实' })).toHaveStyle({ width: '1280px' });
  expect(change).toHaveBeenCalledTimes(1);
});
it('selectable group keyboard resize touches visible resizable leaves only and respects both bounds', () => {
  const helper = createSelectableColumnHelper<{ id: string; quantity: number }>();
  const definitions = helper.columns([
    helper.group({
      id: 'facts',
      header: '事实',
      columns: helper.columns([
        helper.accessor('id', { id: 'id', header: 'ID' }),
        helper.accessor('quantity', { id: 'quantity', header: '数量' }),
      ]),
    }),
  ]);
  function Group() {
    const [sizing, setSizing] = useState<Record<string, number>>({ id: 630, quantity: 80 });
    return (
      <>
        <output aria-label="selectable group widths">{JSON.stringify(sizing)}</output>
        <DataTable
          profile="selectable-list"
          columns={definitions}
          model={{ kind: 'client', rows: [{ id: 'source', quantity: 2 }] }}
          getRowId={row => row.id}
          caption="group"
          labels={labels}
          readState="ready"
          sourceCount={1}
          resultCount={1}
          columnSizing={{ kind: 'controlled', value: sizing, onChange: setSizing }}
          columnVisibility={{ kind: 'internal', initial: { quantity: false } }}
          rowSelection={{ kind: 'internal' }}
          selectionLabels={{
            selectPage: '选择当前页',
            selectRow: id => `选择 ${id}`,
            selected: count => `已选 ${count}`,
            selectAllResults: count => `全部 ${count}`,
            clearSelection: '清除选择',
            allResultsUnavailable: '暂不支持选择全部结果',
          }}
        />
      </>
    );
  }
  render(<Group />);
  const handle = screen.getByRole('button', { name: '调整 facts 列宽' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(screen.getByLabelText('selectable group widths')).toHaveTextContent('{"id":640,"quantity":80}');
  expect(screen.getByRole('columnheader', { name: '事实' })).toHaveStyle({ width: '640px' });
});
it('group keyboard resize clamps each leaf independently at its lower bound', () => {
  render(
    <DataTable
      {...base}
      profile="list"
      columns={h.columns([h.group({ id: 'facts', header: '事实', columns })])}
      model={{ kind: 'client', rows }}
      columnSizing={{ kind: 'internal', initial: { id: 80, quantity: 90 } }}
    />,
  );
  const handle = screen.getByRole('button', { name: '调整 facts 列宽' });
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(screen.getByRole('columnheader', { name: '事实' })).toHaveStyle({ width: '160px' });
  expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveStyle({ width: '80px' });
});

it('applies shared select keyboard choices to the page size and column pin owner', async () => {
  render(<DataTable {...base} profile="list" model={{ kind: 'client', rows }} />);
  const pageSize = screen.getByRole('combobox', { name: labels.pageSize });
  pageSize.focus();
  fireEvent.keyDown(pageSize, { key: 'ArrowDown' });
  const fifty = await screen.findByRole('option', { name: '50' });
  fireEvent.keyDown(fifty, { key: 'Enter' });
  expect(pageSize).toHaveTextContent('50');
  fireEvent.click(screen.getByText(labels.settings));
  const pin = screen.getByRole('combobox', { name: labels.pinColumn('id') });
  pin.focus();
  fireEvent.keyDown(pin, { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: labels.pinEnd }), { key: 'Enter' });
  expect(pin).toHaveTextContent(labels.pinEnd);
  expect(screen.getAllByRole('columnheader')[1]).toHaveStyle({ insetInlineEnd: '0px' });
});
