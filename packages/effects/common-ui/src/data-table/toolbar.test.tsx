import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useTranslation } from '@niubu/locales/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../overlay';
import { DataTable } from './DataTable';
import { createListColumnHelper } from './columns';
import { createDataTableLabels } from './labels';
import type { ColumnVisibilityState, ColumnPinningState, ColumnSizingState, ListSlices, ListTableProps } from './types';

type RecordRow = { id: string; name: string };
const helper = createListColumnHelper<RecordRow>();
const columns = helper.columns([
  helper.accessor('id', { id: 'id', header: 'ID' }),
  helper.accessor('name', { id: 'name', header: '名称' }),
  helper.display({ id: 'actions', header: '操作', cell: () => <button type="button">行操作</button> }),
]);
const rows = [{ id: 'one', name: '第一条' }];
type ColumnOwners = Pick<ListSlices, 'columnVisibility' | 'columnPinning' | 'columnSizing' | 'onResetColumns'>;
function Fixture({ toolbar, pending = false, owners = {} }: { toolbar?: ListTableProps<RecordRow>['toolbar']; pending?: boolean; owners?: ColumnOwners }) {
  const { t } = useTranslation();
  return <DataTable profile="list" caption="记录列表" columns={columns} model={{ kind: 'client', rows: pending ? [] : rows }} getRowId={row => row.id} labels={createDataTableLabels(t)} toolbar={toolbar} {...owners} {...(pending ? { readState: 'pending', sourceCount: null, resultCount: null } : { readState: 'ready', sourceCount: 1, resultCount: 1 })} />;
}

it('owns the caption title and supplied actions in one accessible toolbar without inventing tools', () => {
  const view = render(<Fixture toolbar={{ actions: <button>新增记录</button> }} />);
  const toolbar = screen.getByRole('toolbar', { name: '记录列表' });
  expect(within(toolbar).getByRole('heading', { name: '记录列表' })).toBeVisible();
  expect(within(toolbar).getByRole('button', { name: '新增记录' })).toBeVisible();
  expect(within(toolbar).getByRole('button', { name: '显示设置' })).toBeVisible();
  expect(within(toolbar).queryByRole('button', { name: '搜索' })).not.toBeInTheDocument();
  expect(within(toolbar).queryByRole('button', { name: '刷新' })).not.toBeInTheDocument();
  expect(within(toolbar).queryByRole('button', { name: '全屏' })).not.toBeInTheDocument();
  view.rerender(<Fixture toolbar={{ title: '明确标题' }} />);
  expect(within(toolbar).getByRole('heading', { name: '明确标题' })).toBeVisible();
  view.rerender(<Fixture toolbar={{ title: null }} />);
  expect(within(toolbar).queryByRole('heading')).not.toBeInTheDocument();
});

it('delegates controlled search and refresh and keeps the refresh control while pending', () => {
  const change = vi.fn(); const refresh = vi.fn();
  const view = render(<Fixture toolbar={{ search: { visible: true, onVisibleChange: change }, onRefresh: refresh }} />);
  fireEvent.click(screen.getByRole('button', { name: '搜索', pressed: true }));
  expect(change).toHaveBeenCalledExactlyOnceWith(false);
  const control = screen.getByRole('button', { name: '刷新' });
  control.focus(); fireEvent.click(control); expect(refresh).toHaveBeenCalledOnce();
  view.rerender(<Fixture pending toolbar={{ search: { visible: false, onVisibleChange: change }, onRefresh: refresh }} />);
  expect(screen.getByRole('button', { name: '搜索', pressed: false })).toBeVisible();
  expect(screen.getByRole('button', { name: '刷新' })).toBe(control);
  expect(control).toHaveAttribute('aria-disabled', 'true'); expect(control).toHaveAttribute('aria-busy', 'true'); expect(control).toHaveFocus();
  fireEvent.click(control); expect(refresh).toHaveBeenCalledOnce();
  const outside = document.createElement('input'); document.body.append(outside); outside.focus();
  view.rerender(<Fixture toolbar={{ search: { visible: false, onVisibleChange: change }, onRefresh: refresh }} />);
  expect(outside).toHaveFocus(); outside.remove();
});

it('maximizes the same table and row actions and lets a nested settings popover consume Escape first', async () => {
  function NestedAction() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>附加弹层</button><Modal open={open} onOpenChange={setOpen} title="独立弹层"><input aria-label="弹层内输入" /></Modal></>; }
  const user = userEvent.setup(); render(<Fixture toolbar={{ allowMaximize: true, actions: <NestedAction /> }} />);
  const table = screen.getByRole('table'); const action = screen.getByRole('button', { name: '行操作' });
  const overflow = document.body.style.overflow;
  const maximize = screen.getByRole('button', { name: '全屏' });
  await user.click(maximize);
  expect(screen.getByRole('button', { name: '退出全屏' })).toBe(maximize);
  expect(screen.getByRole('table')).toBe(table); expect(screen.getByRole('button', { name: '行操作' })).toBe(action);
  expect(document.body.style.overflow).toBe(overflow);
  await user.click(screen.getByRole('button', { name: '附加弹层' }));
  expect(screen.getByRole('dialog', { name: '独立弹层' })).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '退出全屏' })).toBe(maximize);
  const settings = screen.getByRole('button', { name: '显示设置' });
  await user.click(settings); expect(screen.getByRole('dialog', { name: '显示设置' })).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '退出全屏' })).toBe(maximize);
  await waitFor(() => expect(settings).toHaveFocus());
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: '全屏' })).toBe(maximize);
  expect(screen.getByRole('table')).toBe(table); expect(screen.getByRole('button', { name: '行操作' })).toBe(action);
  expect(document.body.style.overflow).toBe(overflow);
});

it('uses a real dismissible column popover, compact immediate visibility and pinning, and an advanced disclosure', async () => {
  const user = userEvent.setup(); render(<><button>外部控件</button><Fixture /></>);
  const trigger = screen.getByRole('button', { name: '显示设置' });
  await user.click(trigger);
  const settings = screen.getByRole('dialog', { name: '显示设置' });
  expect(within(settings).queryByRole('spinbutton')).not.toBeInTheDocument();
  await user.click(within(settings).getByRole('button', { name: '固定 id 固定到开头' }));
  expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveStyle({ insetInlineStart: '0px' });
  expect(within(settings).getByRole('button', { name: '固定 id 固定到开头' })).toHaveAttribute('aria-pressed', 'true');
  const end = within(settings).getByRole('button', { name: '固定 id 固定到末尾' });
  await user.click(end); expect(end).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveStyle({ insetInlineEnd: '0px' });
  await user.click(end); expect(end).toHaveAttribute('aria-pressed', 'false');
  await user.click(within(settings).getByRole('checkbox', { name: '显示 name' }));
  await user.click(within(settings).getByRole('checkbox', { name: '显示 actions' }));
  expect(within(settings).getByRole('checkbox', { name: '显示 id' })).toBeDisabled();
  await user.click(within(settings).getByRole('button', { name: '更多列设置' }));
  expect(within(settings).getByRole('spinbutton', { name: 'id 列宽' })).toBeVisible();
  expect(within(settings).getByRole('combobox', { name: '固定 id' })).toBeVisible();
  await user.click(within(settings).getByRole('button', { name: '恢复默认列' }));
  expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: '外部控件' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '外部控件' })).toHaveFocus();
  await user.click(trigger);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
  await waitFor(() => expect(trigger).toHaveFocus());
  await user.click(trigger); await user.keyboard('{Escape}');
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps immediate controlled commits and resets to the external owners defaults', async () => {
  const reset = vi.fn();
  function Owner() {
    const [visibility, setVisibility] = useState<ColumnVisibilityState>({ name: false });
    const [pinning, setPinning] = useState<ColumnPinningState>({ start: [], end: ['id'] });
    const [sizing, setSizing] = useState<ColumnSizingState>({ id: 220 });
    return <Fixture owners={{ columnVisibility: { kind: 'controlled', value: visibility, onChange: setVisibility }, columnPinning: { kind: 'controlled', value: pinning, onChange: setPinning }, columnSizing: { kind: 'controlled', value: sizing, onChange: setSizing }, onResetColumns: () => { reset(); setVisibility({ name: false }); setPinning({ start: [], end: ['id'] }); setSizing({ id: 220 }); } }} />;
  }
  const user = userEvent.setup(); render(<Owner />);
  expect(screen.queryByRole('columnheader', { name: '名称' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '显示设置' }));
  const settings = screen.getByRole('dialog', { name: '显示设置' });
  await user.click(within(settings).getByRole('checkbox', { name: '显示 name' }));
  expect(screen.getByRole('columnheader', { name: '名称' })).toBeVisible();
  await user.click(within(settings).getByRole('button', { name: '固定 id 固定到开头' }));
  expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveStyle({ insetInlineStart: '0px' });
  await user.click(within(settings).getByRole('button', { name: '更多列设置' }));
  const width = within(settings).getByRole('spinbutton', { name: 'id 列宽' });
  fireEvent.change(width, { target: { value: '300' } }); fireEvent.blur(width);
  expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveStyle({ width: '300px' });
  await user.click(within(settings).getByRole('button', { name: '恢复默认列' }));
  expect(reset).toHaveBeenCalledOnce();
  expect(screen.queryByRole('columnheader', { name: '名称' })).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveStyle({ width: '220px', insetInlineEnd: '0px' });
  expect(within(settings).getByRole('spinbutton', { name: 'id 列宽' })).toHaveValue(220);
});

it('renders the single live toolbar outside, retains table state through fullscreen, and releases on retirement', async()=>{
 const refresh=vi.fn();function Owner({show=true}:{show?:boolean}){const [host,setHost]=useState<HTMLDivElement|null>(null);return <><div role="group" aria-label="外置工具" ref={setHost}/>{show&&<Fixture toolbar={{title:null,onRefresh:refresh,allowMaximize:true,render:node=>host?createPortal(node,host):null}}/>}</>;}
 const user=userEvent.setup(),view=render(<Owner/>),host=screen.getByRole('group',{name:'外置工具'}),table=screen.getByRole('table'),section=table.closest('section')!;
 expect(screen.getAllByRole('toolbar',{name:'记录列表'})).toHaveLength(1);expect(within(host).getByRole('toolbar',{name:'记录列表'})).toBeVisible();expect(within(section).queryByRole('toolbar')).not.toBeInTheDocument();
 await user.click(within(host).getByRole('button',{name:'刷新'}));expect(refresh).toHaveBeenCalledOnce();
 await user.click(within(host).getByRole('button',{name:'显示设置'}));let settings=screen.getByRole('dialog',{name:'显示设置'});await user.click(within(settings).getByRole('checkbox',{name:'显示 name'}));await user.click(within(settings).getByRole('button',{name:'更多列设置'}));const width=within(settings).getByRole('spinbutton',{name:'id 列宽'});fireEvent.change(width,{target:{value:'280'}});fireEvent.blur(width);await user.keyboard('{Escape}');
 await user.click(within(host).getByRole('button',{name:'全屏'}));expect(within(host).queryByRole('toolbar')).not.toBeInTheDocument();expect(within(section).getByRole('button',{name:'退出全屏'})).toBeVisible();expect(screen.getByRole('table')).toBe(table);expect(screen.queryByRole('columnheader',{name:'名称'})).not.toBeInTheDocument();expect(screen.getByRole('columnheader',{name:/ID/})).toHaveStyle({width:'280px'});
 await user.click(within(section).getByRole('button',{name:'退出全屏'}));expect(within(host).getByRole('button',{name:'显示设置'})).toBeVisible();expect(screen.getByRole('table')).toBe(table);await user.click(within(host).getByRole('button',{name:'显示设置'}));settings=screen.getByRole('dialog',{name:'显示设置'});await user.click(within(settings).getByRole('button',{name:'恢复默认列'}));expect(screen.getByRole('columnheader',{name:'名称'})).toBeVisible();await user.keyboard('{Escape}');
 view.rerender(<Owner show={false}/>);expect(within(host).queryByRole('toolbar')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'刷新'})).not.toBeInTheDocument();
});

it('preserves the live selection summary and clear action in an external toolbar',async()=>{
 function Owner(){const {t}=useTranslation();const [host,setHost]=useState<HTMLDivElement|null>(null);return <><div role="group" aria-label="选择工具" ref={setHost}/><DataTable<RecordRow> profile="selectable-list" caption="可选数据" columns={[{id:'name',accessorKey:'name',header:'名称'}]} model={{kind:'client',rows}} readState="ready" sourceCount={1} resultCount={1} getRowId={row=>row.id} labels={createDataTableLabels(t)} rowSelection={{kind:'internal'}} selectionLabels={{selectPage:'选择本页',selectRow:id=>'选择 '+id,selected:count=>'已选择 '+count+' 条',selectAllResults:count=>'选择全部 '+count+' 条',clearSelection:'清空选择',allResultsUnavailable:'不可全选'}} toolbar={{title:null,render:node=>host?createPortal(node,host):null}}/></>;}
 render(<Owner/>);const host=screen.getByRole('group',{name:'选择工具'});await userEvent.click(screen.getByRole('checkbox',{name:'选择 one'}));expect(within(host).getByText('已选择 1 条')).toBeVisible();await userEvent.click(within(host).getByRole('button',{name:'清空选择'}));expect(screen.getByRole('checkbox',{name:'选择 one'})).not.toBeChecked();expect(within(host).getByText('已选择 0 条')).toBeVisible();
});

it('keeps keyboard focus on the remounted fullscreen control across an external toolbar transition', async () => {
 function Owner(){const [host,setHost]=useState<HTMLDivElement|null>(null);return <><button>外部输入</button><div role="group" aria-label="焦点工具" ref={setHost}/><Fixture toolbar={{allowMaximize:true,render:node=>host?createPortal(node,host):null}}/></>;}
 const user=userEvent.setup();render(<Owner/>);
 const initial=screen.getByRole('button',{name:'全屏'});initial.focus();await user.keyboard('{Enter}');
 expect(screen.getByRole('button',{name:'退出全屏'})).toHaveFocus();
 await user.keyboard('{Enter}');expect(screen.getByRole('button',{name:'全屏'})).toHaveFocus();
 await user.keyboard(' ');expect(screen.getByRole('button',{name:'退出全屏'})).toHaveFocus();await user.keyboard('{Escape}');expect(screen.getByRole('button',{name:'全屏'})).toHaveFocus();
 await user.click(screen.getByRole('button',{name:'外部输入'}));expect(screen.getByRole('button',{name:'外部输入'})).toHaveFocus();
});
