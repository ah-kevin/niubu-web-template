import { createI18n } from '@niubu/locales';
import type { Locale, LocaleDomTarget } from '@niubu/hooks';
import appZh from './zh-CN/app.json';

export function createPlaygroundI18n(defaultLocale: Locale, domTarget: LocaleDomTarget) {
  return createI18n({
    defaultLocale,
    domTarget,
    appLoaders: {
      app: {
        fallback: appZh,
        async load(locale) {
          return locale === 'zh-CN' ? appZh : (await import('./en-US/app.json')).default;
        },
      },
    },
  });
}
