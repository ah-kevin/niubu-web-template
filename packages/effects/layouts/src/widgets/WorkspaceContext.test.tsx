import {cleanup,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkspaceContext,type WorkspaceContextProps} from './WorkspaceContext';
import {renderWidgets} from './widget-test-utils';
afterEach(cleanup);
const groups=[{value:'one',label:'Current group',options:[{value:'all',label:'Group range'},{value:'project',label:'A very long current range name'},{value:'locked',label:'Unavailable range',disabled:true}]},{value:'two',label:'Other group'}];
const base:WorkspaceContextProps={label:'Workspace',groupLabel:'Group',rangeLabel:'Scope',groupValue:'one',value:'all',groups,placeholder:'Choose scope',emptyLabel:'No available scopes',groupActionLabel:'Switch group',groupActionDescription:'Load its scopes after switching'};
it('shows a single fixed context without a redundant trigger',async()=>{
 await renderWidgets(<WorkspaceContext {...base} groups={[{...groups[0],options:[groups[0].options![0]]}]}/>);expect(screen.getByRole('group',{name:'Workspace'})).toHaveTextContent('Current group');expect(screen.getByRole('group')).toHaveTextContent('Group range');expect(screen.queryByRole('button')).toBeNull();
});
it('inspects another group without switching or fabricating scopes, then switches only on the explicit action',async()=>{
 const tenant=vi.fn(),scope=vi.fn(),user=userEvent.setup();await renderWidgets(<WorkspaceContext {...base} onGroupChange={tenant} onValueChange={scope}/>);
 await user.click(screen.getByRole('button',{name:'Workspace: Current group / Group range'}));const dialog=await screen.findByRole('dialog',{name:'Workspace'});await user.click(within(dialog).getByRole('button',{name:'Other group'}));expect(tenant).not.toHaveBeenCalled();expect(scope).not.toHaveBeenCalled();expect(within(dialog).queryByRole('button',{name:'A very long current range name'})).toBeNull();expect(within(dialog).getByText('Load its scopes after switching')).toBeVisible();await user.click(within(dialog).getByRole('button',{name:'Switch group'}));expect(tenant).toHaveBeenCalledExactlyOnceWith('two');expect(scope).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();
});
it('only emits a different enabled scope of the active group and closes the popup',async()=>{
 const scope=vi.fn(),user=userEvent.setup();await renderWidgets(<WorkspaceContext {...base} onValueChange={scope}/>);const trigger=screen.getByRole('button',{name:'Workspace: Current group / Group range'});await user.click(trigger);let dialog=await screen.findByRole('dialog');expect(within(dialog).getByRole('button',{name:'Group range'})).toHaveAttribute('aria-pressed','true');expect(within(dialog).getByRole('button',{name:'Unavailable range'})).toBeDisabled();await user.click(within(dialog).getByRole('button',{name:'Group range'}));expect(scope).not.toHaveBeenCalled();await user.click(trigger);dialog=await screen.findByRole('dialog');await user.click(within(dialog).getByRole('button',{name:'A very long current range name'}));expect(scope).toHaveBeenCalledExactlyOnceWith('project');expect(screen.queryByRole('dialog')).toBeNull();
});
it('closes on pending or owner changes and never reopens a stale popup on recovery',async()=>{
 const props={...base,onGroupChange:vi.fn(),onValueChange:vi.fn()},user=userEvent.setup(),view=await renderWidgets(<WorkspaceContext {...props}/>);await user.click(screen.getByRole('button',{name:'Workspace: Current group / Group range'}));await screen.findByRole('dialog');view.rerender(<WorkspaceContext {...props} disabled/>);expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('button',{name:'Workspace: Current group / Group range'})).toBeDisabled();view.rerender(<WorkspaceContext {...props}/>);expect(screen.queryByRole('dialog')).toBeNull();await user.click(screen.getByRole('button',{name:'Workspace: Current group / Group range'}));view.rerender(<WorkspaceContext {...props} groupValue="two" value="missing"/>);expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('button',{name:'Workspace: Other group / Choose scope'})).toBeVisible();
});
it('keeps the full context accessible in compact form and does not auto-select an invalid range',async()=>{
 await renderWidgets(<WorkspaceContext {...base} value="missing" compact onValueChange={vi.fn()}/>);expect(screen.getByRole('button',{name:'Workspace: Current group / Choose scope'})).toHaveAttribute('title','Current group / Choose scope');expect(screen.getByRole('group')).not.toHaveTextContent('Group range');
});
it('returns focus to the actual trigger when Escape dismisses the popup',async()=>{
 const user=userEvent.setup();await renderWidgets(<WorkspaceContext {...base} onValueChange={vi.fn()}/>);const trigger=screen.getByRole('button',{name:'Workspace: Current group / Group range'});await user.click(trigger);await screen.findByRole('dialog');await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(trigger).toHaveFocus();
});
it('does not allow choosing scopes from a disabled active group',async()=>{
 const change=vi.fn(),user=userEvent.setup();await renderWidgets(<WorkspaceContext {...base} groups={[{...groups[0],disabled:true},groups[1]]} onValueChange={change} onGroupChange={vi.fn()}/>);await user.click(screen.getByRole('button',{name:'Workspace: Current group / Group range'}));const dialog=await screen.findByRole('dialog');expect(within(dialog).getByRole('button',{name:'A very long current range name'})).toBeDisabled();expect(change).not.toHaveBeenCalled();
});
