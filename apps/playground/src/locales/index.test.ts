import { expect, it } from 'vitest';
import { createPlaygroundI18n } from './index';
import appZh from './zh-CN/app.json';
import appEn from './en-US/app.json';

it('prepares the selected complete app language without requiring a synchronous Chinese app fallback', async () => {
  const target = { lang: '', dir: '' };
  const instance = createPlaygroundI18n('en-US', target);
  try {
    expect(instance.getResource('zh-CN', 'app')).toBeUndefined();
    await instance.changeLocale('en-US', instance.requiredNamespaces);
    expect(instance.getResource('en-US', 'app')).toEqual(appEn);
    expect(instance.getResource('zh-CN', 'app')).toBeUndefined();
    expect(target.lang).toBe('en-US');

    await instance.changeLocale('zh-CN', instance.requiredNamespaces);
    expect(instance.getResource('zh-CN', 'app')).toEqual(appZh);
    expect(target.lang).toBe('zh-CN');
    expect(instance.t('app:examples.tables')).toBe(appZh['examples.tables']);
  } finally {
    instance.dispose();
  }
});
