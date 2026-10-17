import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { QueryPage, QueryRequest } from '@niubu/common-ui/data-table';
import { TablesPage, type SyntheticRow, type SyntheticTableLoader } from './TablesPage';

const region = (name: string) => within(screen.getByRole('region', { name }));
const client = () => region('客户端可选列表');
const remote = () => region('合成服务器列表');
const ids = (area: ReturnType<typeof within>) => area.queryAllByRole('row').slice(1).map((row: HTMLElement) => row.getAttribute('data-row-id'));
function deferredServer() {
  const calls: { request: QueryRequest<{ term: string }>; scope: string; resolve: (page: QueryPage<SyntheticRow>) => void; reject: (error: Error) => void }[] = [];
  const load: SyntheticTableLoader = (request, scope) => new Promise((resolve, reject) => calls.push({ request, scope, resolve, reject }));
  const page = (id: string, name: string, rowCount = 1): QueryPage<SyntheticRow> => ({ rows: [{ id, name, score: 42, active: true }], rowCount });
  const reply = async (index: number, id: string, name: string, count = 1) => {
    await act(async () => calls[index]!.resolve(page(id, name, count)));
  };
  return { calls, load, reply };
}

describe('DataTable existing-capability examples', () => {
  it('keeps read/list/selectable profiles distinct and sorts, pages and selects stable client IDs', async () => {
    render(<TablesPage />);
    expect(region('只读数据').queryByRole('button')).not.toBeInTheDocument();
    expect(region('普通列表').queryByRole('checkbox', { name: '选择本页' })).not.toBeInTheDocument();
    expect(ids(client())).toEqual(['sample-1', 'sample-2']);
    expect(client().getByText('启用')).toBeInTheDocument();
    fireEvent.click(client().getByRole('button', { name: '排序 名称' }));
    expect(ids(client())).toEqual(['sample-4', 'sample-2']);
    fireEvent.click(client().getByRole('checkbox', { name: '选择 sample-2' }));
    fireEvent.click(client().getByRole('button', { name: '下一页' }));
    expect(ids(client())).toEqual(['sample-3', 'sample-1']);
    expect(client().getByText('已选择 1 条')).toBeInTheDocument();
    fireEvent.click(client().getByRole('checkbox', { name: '选择本页' }));
    expect(client().getByText('已选择 3 条')).toBeInTheDocument();
    fireEvent.click(client().getByRole('button', { name: '清空选择' }));
    expect(client().getByText('已选择 0 条')).toBeInTheDocument();
    fireEvent.change(client().getByRole('combobox', { name: '每页条数' }), { target: { value: '25' } });
    expect(ids(client())).toEqual(['sample-4', 'sample-2', 'sample-3', 'sample-1']);
    await screen.findByText('North · Cedar');
  });

  it('controls visibility, width and logical pinning through isolated scoped preferences and resets them', async () => {
    render(<TablesPage />);
    fireEvent.click(client().getByText('显示设置'));
    fireEvent.click(client().getByRole('checkbox', { name: '显示 分数' }));
    expect(client().queryByRole('columnheader', { name: /分数/ })).not.toBeInTheDocument();
    fireEvent.change(client().getByRole('combobox', { name: '固定 名称' }), { target: { value: 'start' } });
    const width = client().getByRole('spinbutton', { name: '名称 列宽' });
    fireEvent.change(width, { target: { value: '240' } });
    fireEvent.blur(width);
    expect(client().getByRole('columnheader', { name: /名称/ })).toHaveStyle({ position: 'sticky', width: '240px', insetInlineStart: '0px' });
    fireEvent.change(screen.getByRole('combobox', { name: '演示作用域' }), { target: { value: 'south' } });
    expect(client().getByRole('checkbox', { name: '显示 分数' })).toBeChecked();
    expect(client().getByRole('combobox', { name: '固定 名称' })).toHaveValue('none');
    fireEvent.change(screen.getByRole('combobox', { name: '演示作用域' }), { target: { value: 'north' } });
    expect(client().getByRole('checkbox', { name: '显示 分数' })).not.toBeChecked();
    expect(client().getByRole('combobox', { name: '固定 名称' })).toHaveValue('start');
    fireEvent.click(client().getByRole('button', { name: '恢复默认列' }));
    expect(client().getByRole('checkbox', { name: '显示 分数' })).toBeChecked();
    expect(client().getByRole('combobox', { name: '固定 名称' })).toHaveValue('none');
    await screen.findByText('North · Cedar');
  });

  it('keeps preference interactions live after StrictMode effect replay and starts fresh on a real remount', async () => {
    const view = render(<StrictMode><TablesPage /></StrictMode>);
    await screen.findByText('North · Cedar');
    fireEvent.click(client().getByText('显示设置'));
    fireEvent.click(client().getByRole('checkbox', { name: '显示 分数' }));
    expect(client().queryByRole('columnheader', { name: /分数/ })).not.toBeInTheDocument();
    view.unmount();
    await act(async () => {});
    render(<TablesPage />);
    expect(client().getByRole('columnheader', { name: /分数/ })).toBeInTheDocument();
    await screen.findByText('North · Cedar');
  });

  it('runs the actual synthetic server fixture for filtered, sorted and paginated reads', async () => {
    render(<TablesPage />);
    await screen.findByText('North · Cedar');
    fireEvent.click(remote().getByRole('button', { name: '下一页' }));
    await screen.findByText('North · Birch');
    expect(ids(remote())).toEqual(['north-3', 'north-4']);
    fireEvent.change(screen.getByRole('textbox', { name: '名称包含' }), { target: { value: 'birch' } });
    fireEvent.click(screen.getByRole('button', { name: '查询合成数据' }));
    await waitFor(() => expect(ids(remote())).toEqual(['north-3']));
    fireEvent.click(screen.getByRole('button', { name: '重置查询' }));
    await screen.findByText('North · Cedar');
    fireEvent.click(remote().getByRole('button', { name: '排序 分数' }));
    await waitFor(() => expect(ids(remote())).toEqual(['north-3', 'north-2']));
  });

  it('reloads applied filters rather than drafts, resets to defaults and aborts superseded reads', async () => {
    const server = deferredServer();
    render(<TablesPage load={server.load} />);
    await waitFor(() => expect(server.calls).toHaveLength(1));
    await server.reply(0, 'first', 'Initial', 8);
    fireEvent.click(remote().getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(server.calls).toHaveLength(2));
    expect(server.calls[1]!.request.pagination).toEqual({ pageIndex: 1, pageSize: 2 });
    await server.reply(1, 'second', 'Page two', 8);
    fireEvent.change(screen.getByRole('textbox', { name: '名称包含' }), { target: { value: '  Cedar  ' } });
    fireEvent.click(screen.getByRole('button', { name: '查询合成数据' }));
    await waitFor(() => expect(server.calls).toHaveLength(3));
    expect(server.calls[2]!.request).toMatchObject({ query: { term: 'Cedar' }, pagination: { pageIndex: 0, pageSize: 2 } });
    await server.reply(2, 'cedar', 'Applied Cedar');
    fireEvent.change(screen.getByRole('textbox', { name: '名称包含' }), { target: { value: 'Birch draft' } });
    fireEvent.click(screen.getByRole('button', { name: '刷新已应用查询' }));
    await waitFor(() => expect(server.calls).toHaveLength(4));
    expect(server.calls[3]!.request.query).toEqual({ term: 'Cedar' });
    fireEvent.click(screen.getByRole('button', { name: '重置查询' }));
    await waitFor(() => expect(server.calls).toHaveLength(5));
    expect(server.calls[3]!.request.signal.aborted).toBe(true);
    expect(server.calls[4]!.request.query).toEqual({ term: '' });
    expect(screen.getByRole('textbox', { name: '名称包含' })).toHaveValue('');
    await server.reply(4, 'current', 'Reset result');
    await server.reply(3, 'stale', 'Stale reload');
    expect(remote().getByText('Reset result')).toBeInTheDocument();
    expect(screen.queryByText('Stale reload')).not.toBeInTheDocument();
  });

  it('retires scope reads, ignores late replies and aborts the pending read on unmount', async () => {
    const server = deferredServer();
    const view = render(<TablesPage load={server.load} />);
    await waitFor(() => expect(server.calls).toHaveLength(1));
    fireEvent.change(screen.getByRole('combobox', { name: '演示作用域' }), { target: { value: 'south' } });
    await waitFor(() => expect(server.calls).toHaveLength(2));
    expect(server.calls[0]!.request.signal.aborted).toBe(true);
    expect(server.calls[1]!.scope).toBe('south');
    await server.reply(1, 'south-current', 'South current');
    await server.reply(0, 'north-stale', 'North stale');
    expect(remote().getByText('South current')).toBeInTheDocument();
    expect(screen.queryByText('North stale')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新已应用查询' }));
    await waitFor(() => expect(server.calls).toHaveLength(3));
    view.unmount();
    expect(server.calls[2]!.request.signal.aborted).toBe(true);
    await server.reply(2, 'late-unmounted', 'Late unmounted');
  });

  it('cancels explicitly and keeps a late failure out of the next successful result', async () => {
    const server = deferredServer();
    render(<TablesPage load={server.load} />);
    await waitFor(() => expect(server.calls).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: '取消加载' }));
    expect(server.calls[0]!.request.signal.aborted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '刷新已应用查询' }));
    await waitFor(() => expect(server.calls).toHaveLength(2));
    await server.reply(1, 'new', 'Newest');
    await act(async () => server.calls[0]!.reject(new Error('Late failure')));
    expect(remote().getByText('Newest')).toBeInTheDocument();
    expect(remote().queryByRole('alert')).not.toBeInTheDocument();
  });
});
