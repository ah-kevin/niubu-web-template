import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@niubu/locales/react';
import { createPlaygroundI18n } from '../../locales';
import formsGuideUrl from '../guides/forms.md?url&no-inline';
import { FormsPage } from './FormsPage';

const methods = ['scrollIntoView', 'hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const;
const originals = methods.map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
beforeAll(() => {
  for (const key of methods)
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, value: key === 'hasPointerCapture' ? () => false : () => {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerType = 'mouse'; pointerId = 1; });
});
afterAll(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, key);
  }
  vi.unstubAllGlobals();
});
const instances: ReturnType<typeof createPlaygroundI18n>[] = [];
afterEach(() => {
  cleanup();
  instances.splice(0).forEach(instance => instance.dispose());
});
function mount(props: Parameters<typeof FormsPage>[0] = {}) {
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  instances.push(i18n);
  render(<I18nProvider instance={i18n}><FormsPage {...props} /></I18nProvider>);
  return async (locale: 'en-US' | 'zh-CN') => {
    await act(() => i18n.changeLocale(locale, i18n.requiredNamespaces));
  };
}
async function scenario(id: string) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${id} ·`) }));
}

describe('FormsPage live locale metadata', () => {
  it.each([
    ['E43', '名称', 'Name'], ['E44', '名称', 'Name'], ['E46', '名称', 'Name'],
    ['E47', '代码', 'Code'], ['E48', '企业名称', 'Company'], ['E51', '关键词', 'Keyword'],
    ['E52', '名称', 'Name'], ['E53', '名称', 'Name'], ['E54', '名称', 'Name'],
  ])('%s changes labels zh→en→zh on the same dirty input and keeps its reset baseline', async (id, zh, en) => {
    const changeLocale = mount();
    await scenario(id);
    if (id === 'E48') await userEvent.click(screen.getByRole('checkbox', { name: '企业账户' }));
    if (id === 'E53') await userEvent.click(screen.getByRole('button', { name: '提交并聚焦' }));
    const input = screen.getByRole('textbox', { name: zh });
    fireEvent.change(input, { target: { value: 'Dirty retained input' } });
    const form = input.closest('form');
    await changeLocale('en-US');
    expect(screen.getByRole('textbox', { name: en })).toBe(input);
    expect(input).toHaveValue('Dirty retained input');
    expect(input.closest('form')).toBe(form);
    await changeLocale('zh-CN');
    expect(screen.getByRole('textbox', { name: zh })).toBe(input);
    expect(input).toHaveValue('Dirty retained input');
    if (id === 'E43') {
      await userEvent.click(screen.getByRole('button', { name: '重置值' }));
      expect(input).toHaveValue('Ada');
    }
  });

  it('changes selected option text, checkbox/radio labels and password help without resetting values', async () => {
    const changeLocale = mount();
    await scenario('E44');
    const select = screen.getByRole('combobox', { name: '分类' });
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: '研究' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '邮件' }));
    await userEvent.click(screen.getByRole('radio', { name: '快递' }));
    const password = screen.getByLabelText('合成密码');
    await changeLocale('en-US');
    expect(screen.getByRole('combobox', { name: 'Category' })).toBe(select);
    expect(select).toHaveTextContent('Research');
    expect(screen.getByRole('checkbox', { name: 'Email' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Express' })).toBeChecked();
    expect(password).toHaveAccessibleDescription('Use synthetic text only. Passwords are excluded from the public preview.');
    await changeLocale('zh-CN');
    expect(select).toHaveTextContent('研究');
    expect(screen.getByRole('checkbox', { name: '邮件' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '快递' })).toBeChecked();
    expect(password).toHaveAccessibleDescription('仅使用合成文字；公开预览不包含密码。');
  });

  it.each([
    ['E43', '名称', '提交值', 'Submit values', '请输入至少两个字符', 'Enter at least two characters'],
    ['E47', '代码', '提交代码', 'Submit code', '请输入 EX- 加数字', 'Use EX- followed by digits'],
    ['E48', '企业名称', '提交联动字段', 'Submit derived fields', '请输入企业名称', 'Enter a company name'],
    ['E52', '名称', '提交校验结果', 'Submit validated values', '请输入至少两个字符', 'Enter at least two characters'],
    ['E53', '名称', '提交并聚焦', 'Submit and focus', '请输入至少两个字符', 'Enter at least two characters'],
  ])('%s translates existing errors and future validation without replacing input', async (id, label, submitZh, submitEn, errorZh, errorEn) => {
    const changeLocale = mount();
    await scenario(id);
    if (id === 'E48') await userEvent.click(screen.getByRole('checkbox', { name: '企业账户' }));
    if (id === 'E53') await userEvent.click(screen.getByRole('button', { name: submitZh }));
    const input = screen.getByRole('textbox', { name: label });
    fireEvent.change(input, { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: submitZh }));
    expect(await screen.findByRole('alert')).toHaveTextContent(errorZh);
    await changeLocale('en-US');
    expect(screen.getByRole('alert')).toHaveTextContent(errorEn);
    expect(input).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: submitEn }));
    expect(screen.getByRole('alert')).toHaveTextContent(errorEn);
    await changeLocale('zh-CN');
    expect(screen.getByRole('alert')).toHaveTextContent(errorZh);
    expect(input).toHaveValue('');
  });

  it('retains the exact pending submit context signal and a manual locked field across both locale changes', async () => {
    let signal: AbortSignal | undefined;
    let complete!: () => void;
    const save = new Promise<void>(resolve => { complete = resolve; });
    const savedNames: string[] = [];
    const changeLocale = mount({ saveName: async (name, context) => {
      signal = context.signal;
      await save;
      if (!context.signal.aborted) savedNames.push(name);
    } });
    const input = screen.getByRole('textbox', { name: '名称' });
    fireEvent.change(input, { target: { value: 'Dirty pending' } });
    await userEvent.click(screen.getByRole('button', { name: '更新已有字段' }));
    expect(input).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '提交值' }));
    await waitFor(() => expect(signal).toBeDefined());
    const originalSignal = signal;
    await changeLocale('en-US');
    expect(screen.getByRole('textbox', { name: 'Locked name' })).toBe(input);
    expect(input).toBeDisabled();
    expect(input).toHaveValue('Dirty pending');
    expect(signal).toBe(originalSignal);
    expect(signal?.aborted).toBe(false);
    expect(screen.getByLabelText('Operation status')).toHaveTextContent('Pending');
    await changeLocale('zh-CN');
    expect(screen.getByRole('textbox', { name: '锁定名称' })).toBe(input);
    expect(input).toBeDisabled();
    expect(signal).toBe(originalSignal);
    expect(signal?.aborted).toBe(false);
    await act(async () => complete());
    await waitFor(() => expect(screen.getByLabelText('已提交名称')).toHaveTextContent('Dirty pending'));
    expect(savedNames).toEqual(['Dirty pending']);
  });

  it('links the common heading to the bundled repository form guide for E44/E46/E54', async () => {
    mount();
    for (const id of ['E44', 'E46', 'E54']) {
      await scenario(id);
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute('href', formsGuideUrl);
      expect(links[0].compareDocumentPosition(screen.getByRole('navigation')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
