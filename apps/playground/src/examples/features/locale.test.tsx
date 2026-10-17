import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { I18nProvider } from '@niubu/locales/react';
import { createPlaygroundI18n } from '../../locales';
import { BrowserFeaturesPage } from './BrowserFeaturesPage';
import { PreferencesPage } from './PreferencesPage';
import { QueryPage } from './QueryPage';

it('switches browser and preference copy while retaining the edited watermark and extension', async () => {
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  const view = render(<I18nProvider instance={i18n}><BrowserFeaturesPage /><PreferencesPage /></I18nProvider>);
  try {
    const watermark = await screen.findByRole('textbox', { name: '演示水印文本' });
    fireEvent.change(watermark, { target: { value: 'Local demo' } });
    fireEvent.click(await screen.findByRole('button', { name: '应用宽屏预设' }));
    await act(() => i18n.changeLocale('en-US', i18n.requiredNamespaces));
    expect(screen.getByRole('heading', { name: 'Existing browser capabilities' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy demo configuration' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Demo watermark text' })).toBe(watermark);
    expect(watermark).toHaveValue('Local demo');
    expect(screen.getByRole('heading', { name: 'Business preference extension' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset business extension' })).toBeInTheDocument();
    expect(screen.getByText('Business view: wide / Summary: hidden')).toBeInTheDocument();
    await act(() => i18n.changeLocale('zh-CN', i18n.requiredNamespaces));
    expect(screen.getByText('业务视图：wide / 摘要：隐藏')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '演示水印文本' })).toBe(watermark);
  } finally { view.unmount(); i18n.dispose(); }
});

it('switches query labels while retaining context selection and the current page', async () => {
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  const view = render(<I18nProvider instance={i18n}><QueryPage /></I18nProvider>);
  try {
    fireEvent.change(screen.getByRole('combobox', { name: '合成 scope' }), { target: { value: 'south' } });
    await screen.findByText('synthetic-reader / south / 0 · 第 1 页 · 条目 1');
    const scope = screen.getByRole('combobox', { name: '合成 scope' });
    await act(() => i18n.changeLocale('en-US', i18n.requiredNamespaces));
    expect(screen.getByRole('combobox', { name: 'Synthetic scope' })).toBe(scope);
    expect(scope).toHaveValue('south');
    expect(screen.getByRole('heading', { name: 'Paginated queries' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    expect(screen.getByText('Current page: 1')).toBeInTheDocument();
    expect(screen.getByText('synthetic-reader / south / 0 · Page 1 · Item 1')).toBeInTheDocument();
    await act(() => i18n.changeLocale('zh-CN', i18n.requiredNamespaces));
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
    expect(scope).toHaveValue('south');
  } finally { view.unmount(); i18n.dispose(); }
});
