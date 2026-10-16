import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createI18n } from './instance';
import { I18nProvider, useTranslation } from './react';
function Probe({ name }: { name: string }) {
  const { t, locale } = useTranslation();
  return (
    <p data-testid={name}>
      {locale}: {t('cancel')}
    </p>
  );
}
it('binds two providers independently without registering a default i18next owner', async () => {
  const first = createI18n({ defaultLocale: 'zh-CN', appLoaders: {} }),
    second = createI18n({ defaultLocale: 'zh-CN', appLoaders: {} });
  render(
    <>
      <I18nProvider instance={first}>
        <Probe name="one" />
      </I18nProvider>
      <I18nProvider instance={second}>
        <Probe name="two" />
      </I18nProvider>
      <Probe name="standalone" />
    </>,
  );
  await act(() => first.changeLocale('en-US', first.requiredNamespaces));
  expect(screen.getByTestId('one')).toHaveTextContent('en-US: Cancel');
  expect(screen.getByTestId('two')).toHaveTextContent('zh-CN: 取消');
  expect(screen.getByTestId('standalone')).toHaveTextContent('zh-CN: 取消');
});
