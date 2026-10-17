import { screen, waitFor, within } from '@testing-library/react';
import { render } from './fixtures';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { QuickView } from '@niubu/common-ui/quick-view';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem } from '@niubu/shadcn-ui/dropdown-menu';
import { ActionPreview } from '@niubu/common-ui/action-preview';
import { FormField, FormFrame, FormGroup } from '@niubu/common-ui/form-frame';
import { InteractionProvider } from '@niubu/stores/react';
import { useRestorableForm } from '@niubu/common-ui/form-frame';
import { useInteractionState } from '@niubu/stores';
beforeEach(() => { localStorage.clear(); vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })); });
describe('restorable UI edge cases', () => {
  it('restores focus to ActionPreview trigger after cancel and confirmation', async () => {
    const user = userEvent.setup(); render(<ActionPreview valid><p>预览内容</p></ActionPreview>);
    const trigger = screen.getByRole('button', { name: '检查并继续' });
    await user.click(trigger); await user.click(screen.getByRole('button', { name: '返回修改' })); await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard('{Enter}'); await user.click(screen.getByRole('button', { name: '确认预览' })); await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('returns a menu-opened QuickView to the connected menu trigger', async () => {
    function Fixture() {
      const [open, setOpen] = useState(false);
      return <><DropdownMenu><DropdownMenuTrigger asChild><button>抽屉菜单入口</button></DropdownMenuTrigger><DropdownMenuPortal><DropdownMenuContent><DropdownMenuItem onSelect={() => setOpen(true)}>查看抽屉</DropdownMenuItem></DropdownMenuContent></DropdownMenuPortal></DropdownMenu><QuickView open={open} onOpenChange={setOpen} detailHref="/sales/orders/order-001"><p>实际详情</p></QuickView></>;
    }
    render(<Fixture />);
    const trigger = screen.getByRole('button', { name: '抽屉菜单入口' });
    await userEvent.click(trigger); await userEvent.click(screen.getByRole('menuitem', { name: '查看抽屉' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('does not reopen an invalidated ActionPreview after validity returns', async () => {
    const view = render(<ActionPreview valid><p>当前预览</p></ActionPreview>);
    await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    view.rerender(<ActionPreview valid={false}><p>失效预览</p></ActionPreview>);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    view.rerender(<ActionPreview valid><p>新预览</p></ActionPreview>);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('新预览');
  });
  it('retires a dirty QuickView confirmation when its controlled owner closes', async () => {
    const close = vi.fn();
    const view = render(<InteractionProvider><QuickView open onOpenChange={close} detailHref="/sales/orders/order-001" dirty><p>输入内容</p></QuickView></InteractionProvider>);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeVisible();
    view.rerender(<InteractionProvider><QuickView open={false} onOpenChange={close} detailHref="/sales/orders/order-001" dirty><p>输入内容</p></QuickView></InteractionProvider>);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    view.rerender(<InteractionProvider><QuickView open onOpenChange={close} detailHref="/sales/orders/order-001" dirty><p>输入内容</p></QuickView></InteractionProvider>);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  it('dirty QuickView close and Escape require confirmation and leave no fake submit result', async () => {
    function Fixture() { const [open, setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null); return <><button ref={trigger} onClick={() => setOpen(true)}>查看草稿</button><QuickView open={open} onOpenChange={setOpen} detailHref="/sales/orders/order-001" returnFocusRef={trigger} dirty><p>尚未提交输入</p></QuickView></>; }
    const user = userEvent.setup(); render(<InteractionProvider><Fixture /></InteractionProvider>); await user.click(screen.getByRole('button', { name: '查看草稿' }));
    await user.keyboard('{Escape}'); expect(screen.getByRole('alertdialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '继续编辑' })); expect(screen.getByRole('dialog')).toBeVisible();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' })); await user.click(screen.getByRole('button', { name: '保留草稿并离开' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '查看草稿' })).toHaveFocus()); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('dirty full-detail navigation waits for a single explicit leave confirmation', async () => {
    const navigate = vi.fn(); const close = vi.fn();
    render(<InteractionProvider><QuickView open onOpenChange={close} detailHref="/sales/orders/order-001" dirty onNavigate={navigate}><p>详情草稿</p></QuickView></InteractionProvider>);
    await userEvent.click(screen.getByRole('link', { name: '打开完整详情' }));
    expect(navigate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '保留草稿并离开' }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/sales/orders/order-001');
    expect(close).toHaveBeenCalledWith(false);
  });
  it('does not offer a dirty hard-navigation fallback when its callback is removed during confirmation', async () => {
    const navigate = vi.fn();
    const { rerender } = render(<InteractionProvider><QuickView open onOpenChange={() => {}} detailHref="/sales/orders/order-001" dirty onNavigate={navigate}><p>草稿内容</p></QuickView></InteractionProvider>);
    await userEvent.click(screen.getByRole('link', { name: '打开完整详情' }));
    rerender(<InteractionProvider><QuickView open onOpenChange={() => {}} detailHref="/sales/orders/order-001" dirty><p>草稿内容</p></QuickView></InteractionProvider>);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开完整详情' })).toBeDisabled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('does not promise provider-only draft retention when the dirty drawer has no provider', () => {
    render(<QuickView open onOpenChange={() => {}} detailHref="/sales/orders/order-001" dirty><p>独立输入</p></QuickView>);
    expect(screen.getByRole('button', { name: '打开完整详情' })).toBeDisabled();
    expect(screen.getByText('当前未提供应用内导航，无法保留草稿前往完整详情。请继续编辑；关闭会要求放弃输入。')).toBeVisible();
  });
  it('removes a reverted draft instead of resurrecting stale inputs', async () => {
    const schema = z.object({ name: z.string() });
    function Fixture() {
      const form = useRestorableForm({ schema, defaultValues: { name: '' }, scopeKey: 'workspace:a', draftKey: 'new' });
      const { readDraft } = useInteractionState();
      return <><FormFrame form={form} title="记录" scopeKey="workspace:a" draftKey="new" onCancel={() => {}}><FormGroup title="基础"><FormField name="name" label="名称" /></FormGroup></FormFrame><button onClick={() => form.setValue('name', String(readDraft('workspace:a', 'new') === undefined), { shouldDirty: false })}>检查草稿已清理</button></>;
    }
    const user = userEvent.setup(); render(<InteractionProvider><Fixture /></InteractionProvider>);
    await user.type(screen.getByLabelText('名称'), '旧草稿'); await user.clear(screen.getByLabelText('名称'));
    await user.click(screen.getByRole('button', { name: '检查草稿已清理' })); expect(screen.getByLabelText('名称')).toHaveValue('true');
  });
});
