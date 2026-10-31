import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { render } from './fixtures';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useRestorableForm } from '@niubu/common-ui/form-frame';
import { useInteractionState } from '@niubu/stores';
import { FormField, FormFrame, FormGroup } from '@niubu/common-ui/form-frame';
import { QuickView } from '@niubu/common-ui/quick-view';
import { InteractionProvider } from '@niubu/stores/react';
const schema = z.object({ name: z.string().min(1, '请填写名称'), unit: z.string().min(1, '请填写单位') });
function Fixture({ onCancel = () => {}, scope = 'workspace:workspace-a' }: { onCancel?: () => void; scope?: string }) {
  const form = useRestorableForm({ schema, defaultValues: { name: '', unit: '' }, scopeKey: scope, draftKey: 'record-new' });
  return <FormFrame form={form} title="登记记录" scopeKey={scope} draftKey="record-new" onCancel={onCancel} groups={[{ label: '基本信息', fields: ['name', 'unit'] }]} review={<p>拟登记记录，不提交服务</p>}><FormGroup title="基本信息"><FormField name="name" label="名称" required /><FormField name="unit" label="单位" required /></FormGroup></FormFrame>;
}
function DirtyStatus() { const state = useInteractionState(); return <output aria-label="未保存状态">{String(state.dirty)}</output>; }
function ReopenFixture() {
  const [open, setOpen] = useState(true);
  const [scope, setScope] = useState('workspace:workspace-a');
  return <InteractionProvider><DirtyStatus />{open ? <Fixture scope={scope} onCancel={() => setOpen(false)} /> : <><button onClick={() => setOpen(true)}>重新打开</button><button onClick={() => { setScope('workspace:workspace-b'); setOpen(true); }}>打开另一范围</button></>}</InteractionProvider>;
}
beforeEach(() => { localStorage.clear(); vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })); });
describe('RHF + Zod restorable forms', () => {
  it('shows grouped error feedback and focuses the first actual invalid input', async () => {
    render(<InteractionProvider><Fixture /></InteractionProvider>);
    await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
    await waitFor(() => expect(screen.getByLabelText('名称')).toHaveFocus());
    expect(screen.getByText('请修正以下信息').closest('[role=alert]')).toHaveTextContent('基本信息');
    expect(screen.getAllByRole('alert')).toHaveLength(3);
    expect(screen.getByLabelText('名称')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('请填写单位')).toBeVisible();
  });
  it('cancel can stay, then leave with an in-memory scope-aware draft and reopen it', async () => {
    const user = userEvent.setup(); render(<ReopenFixture />);
    await user.type(screen.getByLabelText('名称'), '草稿订单');
    expect(screen.getByLabelText('未保存状态')).toHaveTextContent('true');
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '继续编辑' }));
    expect(screen.getByLabelText('名称')).toHaveValue('草稿订单');
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '保留草稿并离开' }));
    await user.click(screen.getByRole('button', { name: '重新打开' }));
    expect(screen.getByLabelText('名称')).toHaveValue('草稿订单');
    expect(Object.values(localStorage)).not.toContain(expect.stringContaining('草稿订单'));
  });
  it('never restores a draft into a different scope', async () => {
    const user = userEvent.setup(); render(<ReopenFixture />);
    await user.type(screen.getByLabelText('名称'), '范围 A 草稿');
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '保留草稿并离开' }));
    await user.click(screen.getByRole('button', { name: '打开另一范围' }));
    expect(screen.getByLabelText('名称')).toHaveValue('');
  });
  it('validates before review and repeated confirmations do not clear dirty inputs or invent success', async () => {
    const user = userEvent.setup(); render(<InteractionProvider><DirtyStatus /><Fixture /></InteractionProvider>);
    await user.type(screen.getByLabelText('名称'), '合成记录'); await user.type(screen.getByLabelText('单位'), 'kg');
    for (let i = 0; i < 2; i++) { await user.click(screen.getByRole('button', { name: '检查并继续' })); await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '确认预览' })); }
    expect(screen.getByRole('status', { name: '提交状态' })).toHaveTextContent('尚未连接服务，未提交');
    expect(screen.getByLabelText('未保存状态')).toHaveTextContent('true');
    expect(screen.getByLabelText('名称')).toHaveValue('合成记录');
    expect(screen.queryByText('提交成功')).not.toBeInTheDocument();
  });
  it('warns on document unload only while dirty', async () => {
    const user = userEvent.setup(); render(<InteractionProvider><Fixture /></InteractionProvider>);
    const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false);
    await user.type(screen.getByLabelText('名称'), '待保存');
    const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true);
  });
});
describe('actual dirty QuickView form navigation', () => {
  function Drawer({ onNavigate }: { onNavigate?: (href: string) => void }) {
    const [open, setOpen] = useState(true);
    const { dirty } = useInteractionState();
    return <>
      <button onClick={() => setOpen(true)}>重新打开抽屉</button>
      <QuickView open={open} onOpenChange={setOpen} detailHref="/sales/orders/order-001" dirty={dirty} onNavigate={onNavigate}>
        <Fixture />
      </QuickView>
    </>;
  }

  it('requires an in-app adapter callback for a real dirty form preservation destination', async () => {
    const user = userEvent.setup();
    render(<InteractionProvider><Drawer /></InteractionProvider>);
    await user.type(screen.getByLabelText('名称'), '不跨文档丢失的草稿');
    expect(screen.queryByRole('link', { name: '打开完整详情' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开完整详情' })).toBeDisabled();
    expect(screen.getByText('当前未提供应用内导航，无法保留草稿前往完整详情。请继续编辑或关闭抽屉保留草稿。')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '打开完整详情' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));
    await user.click(screen.getByRole('button', { name: '保留草稿并离开' }));
    await user.click(screen.getByRole('button', { name: '重新打开抽屉' }));
    expect(screen.getByLabelText('名称')).toHaveValue('不跨文档丢失的草稿');
  });

  it('an in-app callback retains the real form draft for repeated detail navigation and reopen', async () => {
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<InteractionProvider><Drawer onNavigate={navigate} /></InteractionProvider>);
    await user.type(screen.getByLabelText('名称'), '应用内完整详情草稿');
    for (let count = 0; count < 2; count++) {
      await user.click(screen.getByRole('link', { name: '打开完整详情' }));
      expect(navigate).toHaveBeenCalledTimes(count);
      await user.click(screen.getByRole('button', { name: '保留草稿并离开' }));
      expect(navigate).toHaveBeenLastCalledWith('/sales/orders/order-001');
      await user.click(screen.getByRole('button', { name: '重新打开抽屉' }));
      expect(screen.getByLabelText('名称')).toHaveValue('应用内完整详情草稿');
    }
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('提交成功')).not.toBeInTheDocument();
  });
});
