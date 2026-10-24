import { flushSync } from 'react-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { RowActions, type RowAction } from './RowActions';
import { Modal } from '../overlay';
import { DataTable } from './DataTable';
import { createListColumnHelper } from './columns';
import { createDataTableLabels } from './labels';

const viewAction = { id: 'view', label: '查看', onSelect: vi.fn() };
const renderActions = (actions: readonly RowAction[], ownerKey = 'scope-a:one') => <RowActions ownerKey={ownerKey} rowLabel="Record One" actions={actions} moreLabel="更多" />;
const openMenu = async () => {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Record One 的更多操作' }), { button: 0, ctrlKey: false });
  return screen.findByRole('menu');
};
afterEach(() => vi.useRealTimers());

it('keeps the primary action visible and secondary actions in a row-named menu', async () => {
  const edit = vi.fn();
  render(renderActions([viewAction, { id: 'edit', label: '编辑', onSelect: edit }]));
  expect(screen.getByRole('button', { name: '查看' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
  fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: '编辑' }));
  await waitFor(() => expect(edit).toHaveBeenCalledOnce());
});
it('does not execute actions on Escape and restores the stable trigger', async () => {
  const edit = vi.fn();render(renderActions([viewAction, { id: 'edit', label: '编辑', onSelect: edit }]));
  const trigger = screen.getByRole('button', { name: 'Record One 的更多操作' });
  fireEvent.keyDown(await openMenu(), { key: 'Escape' });
  await waitFor(() => expect(trigger).toHaveFocus());expect(edit).not.toHaveBeenCalled();
});
it('uses only current committed callbacks and honors disabled changes', async () => {
  const old = vi.fn(), current = vi.fn();
  const result = render(renderActions([viewAction, { id: 'edit', label: '编辑', onSelect: old }]));
  await openMenu();result.rerender(renderActions([viewAction, { id: 'edit', label: '编辑', onSelect: current, disabled: true }]));
  const disabled = screen.getByRole('menuitem', { name: '编辑' });expect(disabled).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(disabled);expect(old).not.toHaveBeenCalled();expect(current).not.toHaveBeenCalled();
  result.rerender(renderActions([viewAction, { id: 'edit', label: '编辑', onSelect: current }]));
  fireEvent.click(screen.getByRole('menuitem', { name: '编辑' }));await waitFor(() => expect(current).toHaveBeenCalledOnce());expect(old).not.toHaveBeenCalled();
});
it('retires an open menu across owner changes and permission shrink/restore', async () => {
  const edit = vi.fn(), actions = [viewAction, { id: 'edit', label: '编辑', onSelect: edit }];
  const result = render(renderActions(actions));await openMenu();result.rerender(renderActions(actions, 'scope-b:one'));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();await openMenu();result.rerender(renderActions([viewAction], 'scope-b:one'));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();result.rerender(renderActions(actions, 'scope-b:one'));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();expect(edit).not.toHaveBeenCalled();
});
it.each(['disabled', 'owner', 'unmount'] as const)('retires selected work before close completes on %s', async reason => {
  const edit = vi.fn(), actions = [viewAction, { id: 'edit', label: '编辑', onSelect: edit }];
  const result = render(renderActions(actions));await openMenu();vi.useFakeTimers();
  act(() => {
    fireEvent.click(screen.getByRole('menuitem', { name: '编辑' }));
    if (reason === 'unmount') result.unmount();
    else result.rerender(renderActions(reason === 'disabled' ? [viewAction, { ...actions[1]!, disabled: true }] : actions, reason === 'owner' ? 'scope-b:one' : 'scope-a:one'));
  });
  await act(async () => { await vi.runAllTimersAsync(); });expect(edit).not.toHaveBeenCalled();
});
it('keeps a menu-opened Modal focus contained and returns to the original connected trigger', async () => {
  function Fixture() {
    const [open, setOpen] = useState(false);
    return <>{renderActions([viewAction, { id: 'edit', label: '编辑', onSelect: () => setOpen(true) }])}<Modal open={open} onOpenChange={setOpen} title="编辑记录" footer={null}><button onClick={() => setOpen(false)}>取消编辑</button></Modal></>;
  }
  render(<Fixture />);const trigger = screen.getByRole('button', { name: 'Record One 的更多操作' });
  fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: '编辑' }));
  const dialog = await screen.findByRole('dialog', { name: '编辑记录' });await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
  expect(trigger.isConnected).toBe(true);fireEvent.click(within(dialog).getByRole('button', { name: '取消编辑' }));await waitFor(() => expect(trigger).toHaveFocus());
});
it('prevents a portalled menu item from also activating its table row', async () => {
  const activate = vi.fn(), edit = vi.fn();const helper = createListColumnHelper<{ id: string }>();
  const columns = helper.columns([helper.accessor('id', { id: 'id', header: 'ID' }), helper.display({ id: 'actions', header: '操作', cell: () => renderActions([viewAction, { id: 'edit', label: '编辑', onSelect: edit }]) })]);
  function Fixture() { const { t } = useTranslation();return <DataTable profile="list" caption="可激活行" model={{ kind: 'client', rows: [{ id: 'one' }] }} getRowId={r => r.id} columns={columns} labels={createDataTableLabels(t)} readState="ready" sourceCount={1} resultCount={1} onRowActivate={activate} />; }
  render(<Fixture />);fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: '编辑' }));await waitFor(() => expect(edit).toHaveBeenCalledOnce());expect(activate).not.toHaveBeenCalled();
});
it('does not invent a menu for one action and rejects ambiguous action IDs', () => {
  const remove = vi.fn();const result = render(renderActions([{ id: 'remove', label: '删除', onSelect: remove, disabled: true, destructive: true }]));
  expect(screen.queryByRole('button', { name: /更多操作/ })).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button', { name: '删除' }));expect(remove).not.toHaveBeenCalled();result.unmount();
  expect(() => render(renderActions([viewAction, { ...viewAction }]))).toThrow(/unique/);
});

it.each(['disabled', 'owner', 'unmount'] as const)('rechecks selected work after a synchronous focus-time %s change', async reason => {
  const edit=vi.fn();let armed=false;
  function Fixture() {
    const [changed,setChanged]=useState(false);
    return <div onFocusCapture={event=>{
      if(armed && event.target instanceof HTMLButtonElement && event.target.getAttribute('aria-haspopup')==='menu') {
        armed=false;flushSync(()=>setChanged(true));
      }
    }}>{!(changed && reason==='unmount') && renderActions([viewAction,{id:'edit',label:'编辑',onSelect:edit,disabled:changed && reason==='disabled'}], changed && reason==='owner' ? 'scope-b:one' : 'scope-a:one')}</div>;
  }
  render(<Fixture />);const menu=await openMenu();armed=true;
  fireEvent.click(within(menu).getByRole('menuitem',{name:'编辑'}));
  await waitFor(()=>expect(armed).toBe(false));expect(edit).not.toHaveBeenCalled();
});
