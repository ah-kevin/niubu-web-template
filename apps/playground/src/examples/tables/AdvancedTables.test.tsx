import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdvancedTables, type AdvancedTableScenario } from './AdvancedTables';
import { selectOption } from '../../tests/select-option';

afterEach(() => vi.useRealTimers());

it('offers ten design choices and navigates locally without mounting all table demos', () => {
  const { container } = render(<AdvancedTables />);
  expect(within(screen.getByRole('table')).getAllByRole('link')).toHaveLength(10);
  expect(container.querySelectorAll('.native-data-table')).toHaveLength(0);
  fireEvent.click(screen.getByRole('link', { name: 'TableEdit · 跳转演示' }));
  expect(screen.getByRole('button', { name: '新增行' })).toBeInTheDocument();
  expect(container.querySelectorAll('.native-data-table')).toHaveLength(1);
  fireEvent.click(screen.getByRole('link', { name: '返回选型' }));
  expect(container.querySelectorAll('.native-data-table')).toHaveLength(0);
});
it.each<AdvancedTableScenario>(['layout', 'header', 'expand', 'edit', 'merge', 'drag', 'states', 'selection', 'single', 'read'])('mounts %s as one independently routable scene', scenario => {
  const { container } = render(<AdvancedTables scenario={scenario} scenarioHref={id => `/examples/tables/${id}`} />);
  expect(container.querySelectorAll('.native-data-table')).toHaveLength(1);
  expect(screen.getByRole('link', { name: '返回选型' })).toHaveAttribute('href', '/examples/tables/choose');
});
it('creates a real editable row, validates, saves asynchronously and removes an unsaved row on cancel', async () => {
  vi.useFakeTimers();
  const { container } = render(<AdvancedTables scenario="edit" />);
  fireEvent.click(screen.getByRole('button', { name: '新增行' }));
  expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(6);
  const anotherEdit = within(container.querySelector('tr[data-row-id="a1"]')!).getByRole('button', { name: '编辑' });
  expect(anotherEdit).toBeDisabled();
  fireEvent.click(anotherEdit);
  expect(container.querySelector('tr[data-row-id="new-1"]')).toHaveAttribute('data-editing', 'true');
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(screen.getByText(/体重必须大于/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '耳标号' }), { target: { value: 'NEW-001' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '体重 (kg)' }), { target: { value: '420' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(screen.getByText('NEW-001')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: '耳标号' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '新增行' }));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(6);
});
it('runs the state retry and clear-filter actions through the public table', async () => {
  const { container } = render(<AdvancedTables scenario="states" />);
  await selectOption(screen.getByRole('combobox', { name: '状态演示' }), '保留数据刷新失败');
  const retained = container.querySelectorAll('tbody tr[data-row-id]');
  expect(retained).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(container.querySelector('[data-refresh="pending"]')).toBeInTheDocument();
  expect(container.querySelectorAll('[data-skeleton-row]')).toHaveLength(0);
  await screen.findByRole('button', { name: '刷新' });
  await selectOption(screen.getByRole('combobox', { name: '状态演示' }), '筛选无结果');
  fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
  expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(5);
});

it('applies multiple header choices in local and manual modes and cycles sorting back to none', async () => {
  const { container } = render(<AdvancedTables scenario="header" />);
  fireEvent.click(screen.getByRole('button', { name: '筛选状态' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '在栏' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '待检疫' }));
  expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));
  expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(4);
  expect(screen.getByText(/在栏, 待检疫/)).toBeInTheDocument();
  await selectOption(screen.getByRole('combobox', { name: '筛选模式' }), '受控结果');
  expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(4);
  const sort = screen.getByRole('button', { name: '排序 体重 (kg)' });
  fireEvent.click(sort); expect(sort.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  fireEvent.click(sort); expect(sort.closest('th')).toHaveAttribute('aria-sort', 'descending');
  fireEvent.click(sort); expect(sort.closest('th')).toHaveAttribute('aria-sort', 'none');
  fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
  expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(5);
});
it('shows disabled choices and leaves selection unchanged when invoking an inner row action', () => {
  const { container } = render(<AdvancedTables scenario="single" />);
  expect(screen.getByRole('radio', { name: '选择 a2' })).toBeDisabled();
  const row = container.querySelector<HTMLElement>('tr[data-row-id="a1"]')!;
  fireEvent.click(within(row).getByRole('button', { name: '查看' }));
  expect(screen.getByRole('radio', { name: '选择 a1' })).not.toBeChecked();
  fireEvent.click(within(row).getByText('NB-2026-0418'));
  expect(screen.getByRole('radio', { name: '选择 a1' })).toBeChecked();
});
it('keeps the reorder callback stable during async persistence and applies the proposed order', async () => {
  vi.useFakeTimers();
  const { container } = render(<AdvancedTables scenario="drag" />);
  const handle = screen.getByRole('button', { name: '移动 NB-2026-0418' });
  fireEvent.keyDown(handle, { key: ' ' }); fireEvent.keyDown(handle, { key: 'ArrowDown' }); fireEvent.keyDown(handle, { key: ' ' });
  expect(handle).toBeDisabled();
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(container.querySelector('tbody tr[data-row-id]')).toHaveAttribute('data-row-id', 'a2');
  expect(screen.getByText('顺序已保存')).toBeInTheDocument();
  expect(handle).not.toBeDisabled();
});
