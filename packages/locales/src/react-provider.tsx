import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { AppI18n } from './instance';
import { I18nContext as Context } from './react-context';
export function I18nProvider({ instance, children }: { instance: AppI18n; children: ReactNode }) {
  return (
    <Context.Provider value={instance}>
      <I18nextProvider i18n={instance.i18n}>{children}</I18nextProvider>
    </Context.Provider>
  );
}
