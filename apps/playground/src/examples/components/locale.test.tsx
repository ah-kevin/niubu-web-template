import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { I18nProvider } from '@niubu/locales/react';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks/storage';
import { createPlaygroundI18n } from '../../locales';
import { ComponentsPage } from './ComponentsPage';
import { FeedbackPage, type ExampleRecord } from './FeedbackPage';

it('switches flat-key control copy in place while retaining selected values and applied output', async () => {
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  const view = render(<I18nProvider instance={i18n}><ComponentsPage /></I18nProvider>);
  try {
    expect(screen.getByRole('heading', { name: '基础控件' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '舒适' }));
    await userEvent.click(screen.getByRole('button', { name: '应用选项' }));
    const selected = screen.getByRole('radio', { name: '舒适' });
    await act(() => i18n.changeLocale('en-US', i18n.requiredNamespaces));
    expect(screen.getByRole('heading', { name: 'Basic controls' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply choices' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Comfortable' })).toBe(selected);
    expect(selected).toBeChecked();
    expect(screen.getByLabelText('Applied choices')).toHaveTextContent('comfortable · none');
    await act(() => i18n.changeLocale('zh-CN', i18n.requiredNamespaces));
    expect(screen.getByRole('button', { name: '重置选项' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '舒适' })).toBe(selected);
  } finally { view.unmount(); i18n.dispose(); }
});

it('switches open overlay labels without remounting input or aborting its pending save', async () => {
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  await i18n.changeLocale('en-US', i18n.requiredNamespaces);
  const manager = createPreferenceManager({
    identity: { storageNamespace: 'copy-test', product: 'example', appId: 'fixture', environment: 'test', identityKey: 'synthetic' },
    storage: createStoragePort({ getItem: () => null, setItem: () => {} }),
  });
  let resolve!: () => void;
  let signal: AbortSignal | undefined;
  let submitted: ExampleRecord | undefined;
  const promise = new Promise<void>(done => { resolve = done; });
  const view = render(<I18nProvider instance={i18n}><PreferenceProvider manager={manager}><FeedbackPage saveRecord={(value, context) => { submitted = value; signal = context.signal; return promise; }} /></PreferenceProvider></I18nProvider>);
  try {
    await userEvent.click(screen.getByRole('button', { name: 'Open Modal' }));
    const input = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.clear(input); await userEvent.type(input, 'Lin');
    await userEvent.click(screen.getByRole('button', { name: 'Save example' }));
    await act(() => i18n.changeLocale('zh-CN', i18n.requiredNamespaces));
    expect(screen.getByRole('dialog', { name: 'Modal：Ada' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '姓名' })).toBe(input);
    expect(input).toHaveValue('Lin');
    expect(screen.getByRole('button', { name: '保存示例' })).toBeDisabled();
    expect(signal?.aborted).toBe(false);
    await act(async () => { resolve(); await promise; });
    expect(submitted).toEqual({ id: 'demo-7', name: 'Lin' });
    expect(screen.getByLabelText('已保存记录')).toHaveTextContent('demo-7 · Lin');
  } finally { view.unmount(); i18n.dispose(); manager.dispose(); }
});
