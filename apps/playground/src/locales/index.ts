import { createI18n } from '@niubu/locales';
import type { Locale, LocaleDomTarget } from '@niubu/hooks';

export function createPlaygroundI18n(defaultLocale: Locale, domTarget: LocaleDomTarget) {
  return createI18n({
    defaultLocale,
    domTarget,
    appNamespaces: ['app'],
    async loadMessages(locale, signal) {
      const app =
        locale === 'zh-CN' ? (await import('./zh-CN/app.json')).default : (await import('./en-US/app.json')).default;
      if (signal.aborted) throw new DOMException('Locale resource aborted', 'AbortError');
      return { app };
    },
  });
}
