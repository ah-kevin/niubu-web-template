import { expect, it } from 'vitest';
import { createI18n } from './instance';
it('owns independent instances, app fallback, and explicit namespace binding', async () => {
  const appLoaders = { app: { fallback: { title: '入口' }, load: async () => ({ title: 'Entry' }) } };
  const one = createI18n({ appLoaders, defaultLocale: 'zh-CN' }),
    two = createI18n({ appLoaders, defaultLocale: 'zh-CN' });
  expect(one.t('app:title')).toBe('入口');
  await one.changeLocale('en-US', ['common', 'validation', 'shell', 'app']);
  expect(one.t('app:title')).toBe('Entry');
  expect(two.t('app:title')).toBe('入口');
  expect(two.getSnapshot().activeLocale).toBe('zh-CN');
  one.dispose();
  two.dispose();
});
it('cannot override public namespaces with app loaders', () => {
  expect(() =>
    createI18n({ defaultLocale: 'zh-CN', appLoaders: { common: { fallback: {}, load: async () => ({}) } } }),
  ).toThrow('public namespace');
});
it('retains valid public and app translations when first preferred load fails', async () => {
  const instance = createI18n({
    defaultLocale: 'en-US',
    appLoaders: {
      app: {
        fallback: { title: '入口' },
        load: async () => {
          throw Error('offline');
        },
      },
    },
  });
  await expect(instance.changeLocale('en-US', ['common', 'app'])).rejects.toThrow('offline');
  expect(instance.t('app:title')).toBe('入口');
  expect(instance.t('common:cancel')).toBe('取消');
  expect(instance.getSnapshot().preferredLocale).toBe('en-US');
});
it('binds an explicit namespace without treating a route parameter colon as an SDK namespace', async () => {
  const instance = createI18n({
    defaultLocale: 'zh-CN',
    appLoaders: {
      app: {
        fallback: { 'page./invite/:token': '接受邀请' },
        load: async () => ({ 'page./invite/:token': 'Accept invitation' }),
      },
    },
  });
  expect(instance.t('app:page./invite/:token')).toBe('接受邀请');
  await instance.changeLocale('en-US', instance.requiredNamespaces);
  expect(instance.t('app:page./invite/:token')).toBe('Accept invitation');
});
it('does not share mutable SDK resource-store objects, including bundled fallback dictionaries', () => {
  const loaders = { app: { fallback: { title: '入口' }, load: async () => ({ title: 'Entry' }) } };
  const one = createI18n({ defaultLocale: 'zh-CN', appLoaders: loaders }),
    two = createI18n({ defaultLocale: 'zh-CN', appLoaders: loaders });
  one.i18n.addResourceBundle('zh-CN', 'app', { title: 'changed' }, true, true);
  one.i18n.addResourceBundle('zh-CN', 'common', { cancel: 'changed' }, true, true);
  expect(two.t('app:title')).toBe('入口');
  expect(two.t('common:cancel')).toBe('取消');
});
