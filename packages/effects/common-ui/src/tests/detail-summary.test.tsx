import { screen, within } from '@testing-library/react';
import { render } from './fixtures';
import { expect, it } from 'vitest';
import { DetailFrame } from '@niubu/common-ui/detail-frame';
const base = {
  title: '同一对象',
  returnTo: '/sales/orders',
  fallback: '/sales/orders',
  onNavigate: () => { },
  source: '合成来源',
  asOf: '2026-10-11T02:00:00Z',
  tabs: [{ id: 'overview', label: '概况' }, { id: 'professional', label: '专业' }]
};
it('optional shared summary is persistent and precedes tab navigation without becoming tab content', () => {
  const summary = <section aria-label="共同身份">稳定 ID · 当前状态</section>;
  const { rerender } = render(<DetailFrame {...base} summary={summary} tab="overview"><p>概况正文</p></DetailFrame>);
  const identity = screen.getByRole('region', { name: '共同身份' });
  expect(identity.closest('[role="tabpanel"]')).toBeNull();
  expect(identity.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  rerender(<DetailFrame {...base} summary={summary} tab="professional"><p>专业正文</p></DetailFrame>);
  expect(screen.getByRole('region', { name: '共同身份' })).toBe(identity);
  expect(within(screen.getByRole('tabpanel')).getByText('专业正文')).toBeVisible();
  rerender(<DetailFrame {...base} tab="professional"><p>原消费者不传摘要</p></DetailFrame>);
  expect(screen.queryByRole('region', { name: '共同身份' })).not.toBeInTheDocument();
  expect(screen.getByText('原消费者不传摘要')).toBeVisible();
});
