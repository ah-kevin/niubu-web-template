import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PresentationExample } from './PresentationExample';
import { selectOption } from '../../tests/select-option';

it('shows selectable table alignment with a start-aligned description override and complete collection details', async () => {
 render(<PresentationExample scope="north" />);
 expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ textAlign: 'center' });
 expect(screen.getByRole('columnheader', { name: /说明/ })).toHaveStyle({ textAlign: 'start' });
 expect(screen.getByText('2 项')).toHaveAttribute('title', 'North (1)\nSouth (2)');
 expect(screen.getByRole('cell', { name: '演示记录 A' })).toHaveAttribute('style', expect.stringContaining('center'));
 await selectOption(screen.getByRole('combobox', { name: '表格对齐' }), '末端');
 expect(screen.getByRole('columnheader', { name: /名称/ })).toHaveStyle({ textAlign: 'end' });
 expect(screen.getByRole('columnheader', { name: /说明/ })).toHaveStyle({ textAlign: 'start' });
});
it('keeps the same row trigger connected through a real menu-opened dialog and a same-scope rerender', async () => {
 const result=render(<PresentationExample scope="north" />);
 const trigger=screen.getByRole('button', { name:'演示记录 A 的更多操作' });
 fireEvent.pointerDown(trigger, {button:0,ctrlKey:false});
 expect(await screen.findByRole('menuitem', {name:'不可用动作'})).toHaveAttribute('aria-disabled','true');
 fireEvent.click(screen.getByRole('menuitem',{name:'打开对话框'}));
 const dialog=await screen.findByRole('dialog',{name:'记录详情'});
 result.rerender(<PresentationExample scope="north" />);expect(trigger.isConnected).toBe(true);
 fireEvent.click(within(dialog).getByRole('button',{name:'关闭'}));await waitFor(()=>expect(trigger).toHaveFocus());
});
it('retires an open menu and dialog when the synthetic scope changes', async () => {
 const result=render(<PresentationExample scope="north" />);
 fireEvent.pointerDown(screen.getByRole('button',{name:'演示记录 A 的更多操作'}),{button:0,ctrlKey:false});await screen.findByRole('menu');
 result.rerender(<PresentationExample scope="south" />);expect(screen.queryByRole('menu')).not.toBeInTheDocument();
 fireEvent.click(screen.getAllByRole('button',{name:'查看详情'})[0]!);await screen.findByRole('dialog');
 result.rerender(<PresentationExample scope="north" />);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('confirms only a local demonstration and displays no fabricated business result', async () => {
 render(<PresentationExample scope="north" />);
 fireEvent.pointerDown(screen.getByRole('button',{name:'演示记录 A 的更多操作'}),{button:0,ctrlKey:false});
 fireEvent.click(await screen.findByRole('menuitem',{name:'确认演示动作'}));
 const dialog=await screen.findByRole('dialog',{name:'确认演示动作'});fireEvent.click(within(dialog).getByRole('button',{name:'确定'}));
 await screen.findByText('已确认本地演示。');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
