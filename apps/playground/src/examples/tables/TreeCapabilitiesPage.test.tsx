import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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


async function saveNodeEditor(name: string, count: string) {
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox', { name: '名称' }), { target: { value: name } });
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: '数量' }), { target: { value: count } });
  fireEvent.click(within(dialog).getByRole('button', { name: '保存节点' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

it('adds and edits stable synthetic nodes while preserving selection and expansion', async () => {
  render(<TreeCapabilitiesPage />);
  const zone = screen.getByText('A 区', { exact: true }).closest('tr')!;
  fireEvent.click(within(zone).getByRole('button', { name: '新增子级' }));
  await saveNodeEditor('新增栏舍', '12');
  const added = screen.getByText('新增栏舍').closest('tr')!;
  const id = added.getAttribute('data-row-id');
  expect(id).toMatch(/^added-/);
  expect(screen.getByRole('checkbox', { name: '选择 新增栏舍' })).toBeChecked();
  expect(screen.getByRole('button', { name: '收起 A 区' })).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(within(added).getByRole('button', { name: '编辑节点' }));
  await saveNodeEditor('改名后的栏舍', '15');
  const edited = screen.getByText('改名后的栏舍').closest('tr')!;
  expect(edited).toHaveAttribute('data-row-id', id);
  expect(within(edited).getByRole('cell', { name: '15' })).toBeVisible();
  expect(screen.getByRole('checkbox', { name: '选择 改名后的栏舍' })).toBeChecked();
  fireEvent.change(screen.getByRole('textbox', { name: '搜索节点' }), { target: { value: '改名后' } });
  expect(screen.getByText('改名后').tagName).toBe('MARK');
  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
  expect(screen.getByRole('button', { name: '收起 A 区' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('改名后的栏舍')).toBeVisible();
});

it('edits a loaded descendant without losing its lazy siblings or stable ID', async () => {
  render(<TreeCapabilitiesPage />);
  fireEvent.click(screen.getByRole('button', { name: '展开 B 区（懒加载）' }));
  const child = (await screen.findByText('B 区（懒加载） · 1 栏')).closest('tr')!;
  fireEvent.click(within(child).getByRole('button', { name: '编辑节点' }));
  await saveNodeEditor('已编辑懒加载子节点', '19');
  expect(screen.getByText('已编辑懒加载子节点').closest('tr')).toHaveAttribute('data-row-id', 'lazy-child');
  expect(screen.getByRole('button', { name: '收起 B 区（懒加载）' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('C 区（首次失败）')).toBeVisible();
  expect(screen.queryByRole('status', { name: '加载子节点' })).not.toBeInTheDocument();
});

it('adds a child to a loaded empty branch and retires its no-children note', async () => {
  render(<TreeCapabilitiesPage />);
  fireEvent.click(screen.getByRole('button', { name: '展开 D 区（空结果）' }));
  expect(await screen.findByText('无子节点')).toBeVisible();
  const emptyBranch = screen.getByText('D 区（空结果）', { exact: true }).closest('tr')!;
  fireEvent.click(within(emptyBranch).getByRole('button', { name: '新增子级' }));
  await saveNodeEditor('D 区新增栏舍', '2');
  expect(screen.getByText('D 区新增栏舍')).toBeVisible();
  expect(screen.queryByText('无子节点')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '收起 D 区（空结果）' })).toHaveAttribute('aria-expanded', 'true');
});
