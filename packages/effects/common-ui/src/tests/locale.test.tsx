import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createI18n } from '@niubu/locales';
import { I18nProvider } from '@niubu/locales/react';
import { ReadState } from '../read-state';
import { ActionPreview } from '../action-preview';
import { FilterBar } from '../filter-bar';
import { DetailFrame } from '../detail-frame';
it('resolves public titles, default props, and aria labels at render time', async () => {
  const instance = createI18n({ defaultLocale: 'zh-CN', appLoaders: {} });
  render(
    <I18nProvider instance={instance}>
      <ReadState status="error" />
      <ActionPreview valid={false}>Fact source unchanged</ActionPreview>
    </I18nProvider>,
  );
  expect(screen.getByRole('heading', { name: '无法读取记录' })).toBeInTheDocument();
  await act(() => instance.changeLocale('en-US', instance.requiredNamespaces));
  expect(screen.getByRole('heading', { name: 'Cannot read records' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check and continue' })).toBeDisabled();
  expect(screen.getByText('Complete required fields and correct errors first.')).toBeInTheDocument();
});
it('formats public asOf in the explicit zone while preserving the source ISO and unit facts', async () => {
  const instance = createI18n({ defaultLocale: 'zh-CN', appLoaders: {} });
  await instance.changeLocale('en-US', instance.requiredNamespaces);
  const { container } = render(
    <I18nProvider instance={instance}>
      <DetailFrame
        title="原单 名称"
        returnTo={null}
        fallback="/"
        onNavigate={() => {}}
        source="来源甲"
        asOf="2026-10-10T23:30:00Z"
        timeZone="Asia/Shanghai"
      >
        0 kg
      </DetailFrame>
    </I18nProvider>,
  );
  expect(screen.getByRole('button', { name: 'Back to list' })).toBeInTheDocument();
  expect(screen.getByText('来源甲', { exact: false })).toBeInTheDocument();
  expect(container.querySelector('time')).toHaveAttribute('dateTime', '2026-10-10T23:30:00Z');
  expect(container.querySelector('time')?.textContent).toContain('Oct 11, 2026');
  expect(screen.getByText('0 kg')).toBeInTheDocument();
});

it('binds public filter search labels without translating caller field labels', async () => {
  const instance = createI18n({ defaultLocale: 'zh-CN', appLoaders: {} });
  await instance.changeLocale('en-US', instance.requiredNamespaces);
  render(
    <I18nProvider instance={instance}>
      <FilterBar
        query={{ q: '', page: 1, pageSize: 25, sort: 'title', direction: 'asc', filters: {} }}
        onQueryChange={() => {}}
      />
    </I18nProvider>,
  );
  expect(screen.getByRole('searchbox', { name: 'Search records' })).toHaveAttribute('placeholder', 'Search records');
});
