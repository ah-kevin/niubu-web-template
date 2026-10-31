import { selectOption } from '../../tests/select-option';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { QueryPage, QueryRequest } from '@niubu/common-ui/data-table';
import { TablesPage, type SyntheticRow, type SyntheticTableLoader } from './TablesPage';

beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterAll(() => vi.unstubAllGlobals());

const region = (name: string) => within(screen.getByRole('region', { name }));
const client = () => region('客户端可选列表');
const remote = () => region('合成服务器列表');
const settings = () => within(screen.getByRole('dialog', { name: '显示设置' }));
async function openSettings(advanced = false) {
  await userEvent.click(client().getByRole('button', { name: '显示设置' }));
  await screen.findByRole('dialog', { name: '显示设置' });
  if (advanced) fireEvent.click(settings().getByRole('button', { name: '更多列设置' }));
}

const ids = (area: ReturnType<typeof within>) => area.queryAllByRole('row').filter((row: HTMLElement) => row.hasAttribute('data-row-id')).map((row: HTMLElement) => row.getAttribute('data-row-id'));
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
  it('demonstrates three real tree levels with disclosure-only expansion and resets at a scope change', async () => {
    render(<TablesPage />);
    const tree = () => region('三层树表');
    expect(ids(tree())).toEqual(['tree-root']);
    expect(tree().queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(tree().getByRole('cell', { name: 'North' }));
    expect(ids(tree())).toEqual(['tree-root']);
    fireEvent.click(tree().getByRole('button', { name: '展开 North' }));
    expect(ids(tree())).toEqual(['tree-root', 'tree-branch']);
    fireEvent.click(tree().getByRole('button', { name: '展开 Branch' }));
    expect(ids(tree())).toEqual(['tree-root', 'tree-branch', 'tree-leaf']);
    expect(tree().queryByRole('button', { name: '展开 Leaf' })).not.toBeInTheDocument();
    await selectOption(screen.getByRole('combobox', { name: '演示作用域' }), 'South（合成）');
    expect(ids(tree())).toEqual(['tree-root']);
    expect(tree().getByRole('button', { name: '展开 South' })).toBeInTheDocument();
    await screen.findByText('South · Cedar');
  });

  it.each(['client', 'server'])('keeps the initial page size available after choosing a larger size in %s data', async kind => {
    render(<TablesPage />);
    await screen.findByText('North · Cedar');
    const area = kind === 'client' ? client : remote;
    await selectOption(area().getByRole('combobox', { name: '每页条数' }), '20 条/页');
    await waitFor(() => expect(ids(area())).toHaveLength(4));
    await selectOption(area().getByRole('combobox', { name: '每页条数' }), '2 条/页');
    await waitFor(() => expect(ids(area())).toHaveLength(2));
  });
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
    await selectOption(client().getByRole('combobox', { name: '每页条数' }), '20 条/页');
    expect(ids(client())).toEqual(['sample-4', 'sample-2', 'sample-3', 'sample-1']);
    await screen.findByText('North · Cedar');
  });

  it('controls visibility, width and logical pinning through isolated scoped preferences and resets them', async () => {
    render(<TablesPage />);
    await openSettings();
    fireEvent.click(settings().getByRole('checkbox', { name: '显示 分数' }));
    expect(client().queryByRole('columnheader', { name: /分数/ })).not.toBeInTheDocument();
    fireEvent.click(settings().getByRole('button', { name: '更多列设置' }));
    await selectOption(settings().getByRole('combobox', { name: '固定 名称' }), '固定到开头');
    const width = settings().getByRole('spinbutton', { name: '名称 列宽' });
    fireEvent.change(width, { target: { value: '240' } });
    fireEvent.blur(width);
    expect(client().getByRole('columnheader', { name: /名称/ })).toHaveStyle({ position: 'sticky', width: '240px', insetInlineStart: '0px' });
    const scope = screen.getByRole('combobox', { name: '演示作用域' });
    await selectOption(scope, 'South（合成）');
    await waitFor(() => expect(scope).toHaveFocus());
    await openSettings(true);
    expect(settings().getByRole('checkbox', { name: '显示 分数' })).toBeChecked();
    expect(settings().getByRole('combobox', { name: '固定 名称' })).toHaveTextContent('取消固定');
    await selectOption(scope, 'North（合成）');
    await waitFor(() => expect(scope).toHaveFocus());
    await openSettings(true);
    expect(settings().getByRole('checkbox', { name: '显示 分数' })).not.toBeChecked();
    expect(settings().getByRole('combobox', { name: '固定 名称' })).toHaveTextContent('固定到开头');
    fireEvent.click(settings().getByRole('button', { name: '恢复默认列' }));
    expect(settings().getByRole('checkbox', { name: '显示 分数' })).toBeChecked();
    expect(settings().getByRole('combobox', { name: '固定 名称' })).toHaveTextContent('取消固定');
    await screen.findByText('North · Cedar');
  });

  it('keeps preference interactions live after StrictMode effect replay and starts fresh on a real remount', async () => {
    const view = render(<StrictMode><TablesPage /></StrictMode>);
    await screen.findByText('North · Cedar');
    await openSettings();
    fireEvent.click(settings().getByRole('checkbox', { name: '显示 分数' }));
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
    await selectOption(screen.getByRole('combobox', { name: '演示作用域' }), 'South（合成）');
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
    expect(remote().getByRole('status')).toHaveTextContent('已取消加载，可重新查询或刷新。');
    expect(screen.getByRole('button', { name: '取消加载' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '刷新已应用查询' }));
    await waitFor(() => expect(server.calls).toHaveLength(2));
    await server.reply(1, 'new', 'Newest');
    await act(async () => server.calls[0]!.reject(new Error('Late failure')));
    expect(remote().getByText('Newest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消加载' })).toBeDisabled();
    expect(remote().queryByRole('alert')).not.toBeInTheDocument();
  });
});


it('recovers lost pagination focus to the stable reload action after a server error', async () => {
  const server = deferredServer();
  render(<TablesPage load={server.load} />);
  await waitFor(() => expect(server.calls).toHaveLength(1));
  await server.reply(0, 'first', 'First page', 8);
  const reload = screen.getByRole('button', { name: '刷新已应用查询' });
  await userEvent.click(remote().getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(server.calls).toHaveLength(2));
  await act(async () => server.calls[1]!.reject(new Error('Page failed')));
  expect(remote().getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '刷新已应用查询' })).toBe(reload);
  await waitFor(() => expect(reload).toHaveFocus());
});


it.each(['query', 'other table'])('does not steal focus after a failed page read when the user moved to %s', async destination => {
  const server = deferredServer();
  render(<TablesPage load={server.load} />);
  await waitFor(() => expect(server.calls).toHaveLength(1));
  await server.reply(0, 'first', 'First page', 8);
  await userEvent.click(remote().getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(server.calls).toHaveLength(2));
  const target = destination === 'query' ? screen.getByRole('textbox', { name: '名称包含' }) : client().getByRole('button', { name: '下一页' });
  await userEvent.click(target);
  await act(async () => server.calls[1]!.reject(new Error('Page failed')));
  expect(remote().getByRole('alert')).toBeInTheDocument();
  expect(target).toHaveFocus();
});


it.each(['page', 'query'])('restores successful remote pagination to %s focus without stealing active input focus', async destination => {
  const server = deferredServer();
  render(<TablesPage load={server.load} />);
  await waitFor(() => expect(server.calls).toHaveLength(1));
  await server.reply(0, 'first', 'First page', 4);
  await userEvent.click(remote().getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(server.calls).toHaveLength(2));
  const query = screen.getByRole('textbox', { name: '名称包含' });
  if (destination === 'query') await userEvent.click(query);
  await server.reply(1, 'last', 'Last page', 4);
  const currentPage = remote().getByRole('button', { name: '第 2 页' });
  expect(remote().getByRole('button', { name: '下一页' })).toBeDisabled();
  await waitFor(() => expect(destination === 'query' ? query : currentPage).toHaveFocus());
});

it('retires pagination focus intent on a scope change and ignores the old scoped reply', async () => {
  const server = deferredServer();
  render(<TablesPage load={server.load} />);
  await waitFor(() => expect(server.calls).toHaveLength(1));
  await server.reply(0, 'north-first', 'North first', 8);
  await userEvent.click(remote().getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(server.calls).toHaveLength(2));
  await selectOption(screen.getByRole('combobox', { name: '演示作用域' }), 'South（合成）');
  await waitFor(() => expect(server.calls).toHaveLength(3));
  (document.activeElement as HTMLElement).blur();
  expect(document.body).toHaveFocus();
  await server.reply(2, 'south-first', 'South first', 8);
  expect(remote().getByText('South first')).toBeInTheDocument();
  expect(document.body).toHaveFocus();
  await server.reply(1, 'north-late', 'North late', 8);
  expect(document.body).toHaveFocus();
  expect(screen.queryByText('North late')).not.toBeInTheDocument();
});

it('lets the tree example choose end alignment while keeping its visible depth inset', async () => {
  render(<TablesPage />);
  const tree = () => region('三层树表');
  await selectOption(screen.getByRole('combobox', { name: '树表对齐' }), '末端');
  fireEvent.click(tree().getByRole('button', { name: '展开 North' }));
  expect(tree().getByRole('cell', { name: 'Branch' }).querySelector('.pattern-tree-cell')).toHaveStyle({ paddingInlineEnd: 'calc(1 * var(--tree-indent))' });
});

it('demonstrates the real tree toolbar in an owned external host and keeps fullscreen exit inside',async()=>{
 render(<TablesPage/>);const tree=screen.getByRole('region',{name:'三层树表'}),host=screen.getByRole('group',{name:'三层树表'});const toolbar=within(host).getByRole('toolbar',{name:'三层树表'});expect(screen.getAllByRole('toolbar',{name:'三层树表'})).toHaveLength(1);const table=within(tree).getByRole('table');expect(table.closest('section')).not.toContainElement(toolbar);
 await userEvent.click(within(host).getByRole('button',{name:'显示设置'}));expect(screen.getByRole('dialog',{name:'显示设置'})).toBeVisible();await userEvent.keyboard('{Escape}');await userEvent.click(within(host).getByRole('button',{name:'全屏'}));expect(within(host).queryByRole('toolbar')).not.toBeInTheDocument();expect(within(table.closest('section')!).getByRole('button',{name:'退出全屏'})).toBeVisible();expect(within(tree).getByRole('table')).toBe(table);await userEvent.keyboard('{Escape}');expect(within(host).getByRole('button',{name:'全屏'})).toBeVisible();
});

it('expands and collapses all tree levels through the existing controlled owner', async () => {
  render(<TablesPage />);
  await userEvent.click(screen.getByRole('button', { name: '展开全部' }));
  expect(ids(region('三层树表'))).toEqual(['tree-root', 'tree-branch', 'tree-leaf']);
  await userEvent.click(screen.getByRole('button', { name: '收起全部' }));
  expect(ids(region('三层树表'))).toEqual(['tree-root']);
});
