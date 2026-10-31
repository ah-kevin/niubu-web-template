import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { InteractionProvider } from '@niubu/stores/react';
import { CompleteListPage } from './CompleteListPage';
import { selectOption } from '../../tests/select-option';

// Radix autofocus may retire after the closing commit.
afterEach(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); });
const mount = () => render(<InteractionProvider><CompleteListPage /></InteractionProvider>);

it('keeps query drafts separate, applies three filters, and resets the actual result', async () => {
  mount();
  const field = screen.getByRole('textbox', { name: '耳标号' });
  fireEvent.change(field, { target: { value: 'missing' } });
  expect(screen.getByText('CN-2026-0418')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  expect(screen.queryByText('CN-2026-0418')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toBeVisible();
  fireEvent.click(screen.getAllByRole('button', { name: '重置' })[0]);
  expect(screen.getByText('CN-2026-0418')).toBeVisible();
  await selectOption(screen.getByRole('combobox', { name: '栏舍' }), 'B 区 1 栏');
  await selectOption(screen.getByRole('combobox', { name: '状态' }), '转栏中');
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  expect(screen.queryByText('CN-2026-0418')).not.toBeInTheDocument();
  expect(screen.getByText('CN-2026-0424')).toBeVisible();
});

it('preserves selection across pages and applies explicit all-results selection', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: '第 2 页' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择 animal-5' }));
  expect(screen.getByText('已选择 2 条')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '第 1 页' }));
  expect(screen.getByRole('checkbox', { name: '选择 animal-0' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '选择全部 128 条结果' }));
  expect(screen.getByText('已选择 128 条')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '清空选择' }));
  expect(screen.getByText('已选择 0 条')).toBeVisible();
});

it('changes only the local body through all four canonical theme/density combinations', async () => {
  const { container } = mount();
  const root = container.querySelector('[data-theme]')!;
  const bodyTheme = document.documentElement.getAttribute('data-theme');
  for (const [label, mode, rowHeight] of [
    ['深色 · 标准', 'dark', '42px'], ['深色 · 紧凑', 'dark', '36px'],
    ['浅色 · 紧凑', 'light', '36px'], ['浅色 · 标准', 'light', '42px'],
  ]) {
    await selectOption(screen.getByRole('combobox', { name: '主体外观' }), label);
    expect(root).toHaveAttribute('data-theme', mode);
    expect(root).toHaveStyle({ '--row-height': rowHeight });
    expect(document.documentElement.getAttribute('data-theme')).toBe(bodyTheme);
  }
});

it('retains headers during loading, error and empty states, and reloads from error', async () => {
  mount();
  const state = screen.getByRole('combobox', { name: '演示读取状态' });
  await selectOption(state, '加载中');
  expect(screen.getByRole('table')).toBeVisible();
  expect(screen.queryByText('CN-2026-0418')).not.toBeInTheDocument();
  await selectOption(state, '加载失败');
  fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
  expect(await screen.findByText('CN-2026-0418')).toBeVisible();
  await selectOption(state, '无结果');
  expect(screen.getByRole('table')).toBeVisible();
  expect(screen.queryByText('CN-2026-0418')).not.toBeInTheDocument();
});

async function saveEditor() {
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  const confirm = await screen.findByRole('alertdialog', { name: '确认保存资料' });
  fireEvent.click(within(confirm).getByRole('button', { name: '确认保存' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}
async function openAction(tag: string, action: string) {
  fireEvent.pointerDown(screen.getByRole('button', { name: `${tag} 的更多操作` }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole('menuitem', { name: action }));
}
it('creates, edits and confirms deletion of synthetic records through the live form owner', async () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: '新增牛只' }));
  const create = await screen.findByRole('dialog', { name: '新增牛只' });
  fireEvent.change(within(create).getByRole('textbox', { name: '耳标号' }), { target: { value: 'TEST-NEW' } });
  await saveEditor();
  expect(screen.getByText('TEST-NEW')).toBeVisible();
  await openAction('TEST-NEW', '编辑牛只');
  const editor = await screen.findByRole('dialog', { name: '编辑牛只' });
  await userEvent.type(within(editor).getByRole('textbox', { name: '备注' }), 'edited locally');
  await saveEditor();
  expect(screen.getByText('edited locally')).toBeVisible();
  await openAction('TEST-NEW', '删除');
  const confirmation = await screen.findByRole('dialog', { name: '删除牛只档案' });
  expect(screen.getByText('TEST-NEW')).toBeVisible();
  fireEvent.click(within(confirmation).getByRole('button', { name: '删除' }));
  await waitFor(() => expect(screen.queryByText('TEST-NEW')).not.toBeInTheDocument());
});
