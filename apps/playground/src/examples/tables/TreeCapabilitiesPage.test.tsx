import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TreeCapabilitiesPage } from './TreeCapabilities';

it('exposes the standalone page and cascades selection without checking disabled nodes', () => {
  render(<TreeCapabilitiesPage />);
  expect(screen.getByRole('heading', { level: 1, name: '树表交互能力' })).toBeVisible();
  const parent = screen.getByRole('checkbox', { name: '选择 示例牧场' });
  expect(parent).toHaveAttribute('aria-checked', 'mixed');
  fireEvent.click(parent);
  expect(screen.getByRole('checkbox', { name: '选择 A 区 1 栏' })).toBeChecked();
  const disabled = screen.getByRole('checkbox', { name: '选择 A 区 2 栏（禁用）' });
  expect(disabled).toBeDisabled();
  expect(disabled).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: '选择 A 区 1 栏' }));
  expect(parent).toHaveAttribute('aria-checked', 'mixed');
});

it('searches matching ancestry and restores the collapsed state when cleared', () => {
  render(<TreeCapabilitiesPage />);
  fireEvent.click(screen.getByRole('button', { name: '收起全部 · 树表交互能力' }));
  expect(screen.queryByText('A 区 1 栏')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '搜索节点' }), { target: { value: 'A 区 1 栏' } });
  expect(screen.getByText('A 区 1 栏').tagName).toBe('MARK');
  expect(screen.queryByText('A 区 2 栏（禁用）')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '收起 示例牧场' })).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
  expect(screen.queryByText('A 区 1 栏')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '展开 示例牧场' })).toHaveAttribute('aria-expanded', 'false');
});

it('runs the actual synthetic loader, exposes retry and empty results, and resets the owner', async () => {
  render(<TreeCapabilitiesPage />);
  fireEvent.click(screen.getByRole('button', { name: '展开全部 · 树表交互能力' }));
  expect(screen.getAllByRole('status', { name: '加载子节点' })).toHaveLength(3);
  expect(await screen.findByText('B 区（懒加载） · 1 栏')).toBeVisible();
  expect(await screen.findByText('无子节点')).toBeVisible();
  expect(await screen.findByRole('alert')).toHaveTextContent('子节点加载失败');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('C 区（首次失败） · 1 栏')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '切换加载 owner' }));
  await waitFor(() => expect(screen.queryByText('B 区（懒加载） · 1 栏')).not.toBeInTheDocument());
  expect(screen.queryByRole('status', { name: '加载子节点' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '展开 B 区（懒加载）' })).toHaveAttribute('aria-expanded', 'false');
});
