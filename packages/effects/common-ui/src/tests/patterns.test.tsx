import { useRef, useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { render } from './fixtures';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterBar } from '@niubu/common-ui/filter-bar';
import { QuickView } from '@niubu/common-ui/quick-view';
import { PageHeader } from '@niubu/common-ui/page-header';
import { DetailFrame } from '@niubu/common-ui/detail-frame';
import { ReadState } from '@niubu/common-ui/read-state';
import { ActionPreview } from '@niubu/common-ui/action-preview';

const query = { q: '', page: 1, pageSize: 25 as const, sort: 'name', direction: 'asc' as const, filters: {} };
beforeEach(() => localStorage.clear());

describe('compositional patterns', () => {
  it('filter/search changes reset first page and clear only list filters', async () => {
    const change = vi.fn(); render(<FilterBar query={{ ...query, page: 3 }} onQueryChange={change} filters={[{ id: 'status', label: '状态', options: [{ value: 'active', label: '启用' }] }]} />);
    await userEvent.type(screen.getByLabelText('搜索记录'), '单');
    expect(change).toHaveBeenLastCalledWith({ ...query, q: '单', page: 1 });
    await userEvent.click(screen.getByRole('checkbox', { name: '启用' }));
    expect(change).toHaveBeenLastCalledWith({ ...query, filters: { status: ['active'] }, page: 1 });
  });
  it('restores focus after Escape and repeated QuickView opening', async () => {
    function Fixture() { const [open, setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null); return <><button ref={trigger} onClick={() => setOpen(true)}>快速查看</button><QuickView open={open} onOpenChange={setOpen} detailHref="/sales/orders/order-001" title="订单档案" returnFocusRef={trigger}><p>订单事实</p></QuickView></>; }
    const user = userEvent.setup(); render(<Fixture />);
    const trigger = screen.getByRole('button', { name: '快速查看' });
    for (let i = 0; i < 2; i++) { await user.click(trigger); expect(screen.getByRole('dialog')).toBeVisible(); expect(screen.getByRole('link', { name: '打开完整详情' })).toHaveAttribute('href', '/sales/orders/order-001'); await user.keyboard('{Escape}'); await waitFor(() => expect(trigger).toHaveFocus()); }
  });
  it('shares detail children and preserves a safe list return destination', async () => {
    const navigate = vi.fn(); const tabChange = vi.fn();
    render(<DetailFrame title="订单档案" returnTo="/sales/orders?page=2&filter.status=active" fallback="/sales/orders" onNavigate={navigate} source="合成静态事实" asOf="2026-10-11T00:00:00Z" tabs={[{ id: 'summary', label: '概要' }, { id: 'details', label: '详情' }]} tab="details" onTabChange={tabChange}><p>共享详情内容</p></DetailFrame>);
    expect(screen.getByRole('tab', { name: '详情' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: '返回列表' }));
    expect(navigate).toHaveBeenCalledWith('/sales/orders?page=2&filter.status=active');
    await userEvent.click(screen.getByRole('tab', { name: '概要' })); expect(tabChange).toHaveBeenCalledWith('summary');
    expect(screen.getByText(/来源：合成静态事实/)).toBeVisible();
  });
  it('keeps 390-width long titles and actions in a bounded wrapping header', () => {
    render(<div style={{ width: 390 }}><PageHeader title={'很长的专业业务标题'.repeat(12)} description="业务说明" actions={<button>新建</button>} /></div>);
    expect(screen.getByRole('heading', { level: 1 }).closest('header')).toHaveClass('pattern-page-header');
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('pattern-title');
    expect(screen.getByRole('button', { name: '新建' })).toBeVisible();
  });
  it('provides an actionable error and an empty-filter reset', async () => {
    const retry = vi.fn(); const reset = vi.fn(); const { rerender } = render(<ReadState status="error" onRetry={retry} message="无法读取" />);
    await userEvent.click(screen.getByRole('button', { name: '重新读取' })); expect(retry).toHaveBeenCalledOnce();
    rerender(<ReadState status="empty" onReset={reset} />);
    await userEvent.click(screen.getByRole('button', { name: '清除筛选' })); expect(reset).toHaveBeenCalledOnce();
  });
  it('shows a reason for unavailable actions and never invents success after repeated confirmation', async () => {
    const { rerender } = render(<ActionPreview valid={false} reason="需要填写必填项"><p>拟登记信息</p></ActionPreview>);
    expect(screen.getByRole('button', { name: '检查并继续' })).toBeDisabled(); expect(screen.getByText('需要填写必填项')).toBeVisible();
    rerender(<ActionPreview valid><p>拟登记信息</p></ActionPreview>);
    for (let i = 0; i < 2; i++) { await userEvent.click(screen.getByRole('button', { name: '检查并继续' })); const dialog = screen.getByRole('alertdialog'); await userEvent.click(within(dialog).getByRole('button', { name: '确认预览' })); expect(screen.getByRole('status')).toHaveTextContent('尚未连接服务，未提交'); }
    expect(screen.queryByText(/提交成功|流水号|已上传/)).not.toBeInTheDocument();
  });
});
