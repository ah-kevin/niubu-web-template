import { describe, expect, it } from 'vitest';
import type { Locale, Resource } from '@niubu/hooks';
import { createI18n } from '../instance';

type Messages = Readonly<Record<string, Resource>>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup() {
  const calls: { locale: Locale; signal: AbortSignal; task: ReturnType<typeof deferred<Messages>> }[] = [];
  const dom = { lang: 'untouched', dir: 'untouched' };
  const instance = createI18n({
    defaultLocale: 'en-US',
    appNamespaces: ['app', 'feature'],
    domTarget: dom,
    loadMessages(locale, signal) {
      const task = deferred<Messages>();
      calls.push({ locale, signal, task });
      return task.promise;
    },
  });
  return { instance, calls, dom };
}
const english = { app: { title: 'Entry {{name}}' }, feature: { 'page./invite/:token': 'Accept invitation' } };
const chinese = { app: { title: '入口 {{name}}' }, feature: { 'page./invite/:token': '接受邀请' } };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('whole-language app messages', () => {
  it('prepares every app namespace before atomically activating the language and DOM', async () => {
    const { instance, calls, dom } = setup();
    expect(instance.t('common:cancel')).toBe('取消');
    expect(instance.requiredNamespaces).toEqual(['common', 'validation', 'shell', 'app', 'feature']);
    const change = instance.changeLocale('en-US', []);
    expect(calls).toHaveLength(1);
    expect(calls[0].locale).toBe('en-US');
    await flush();
    expect(instance.getSnapshot().activeLocale).toBe('zh-CN');
    expect(dom.lang).toBe('untouched');
    expect(instance.i18n.hasResourceBundle('en-US', 'app')).toBe(false);
    calls[0].task.resolve(english);
    await change;
    expect(instance.getSnapshot()).toEqual({ preferredLocale: 'en-US', activeLocale: 'en-US', status: 'ready' });
    expect(instance.t('app:title', { name: 'Ada' })).toBe('Entry Ada');
    expect(instance.t('feature:page./invite/:token')).toBe('Accept invitation');
    expect(instance.t('common:cancel')).toBe('Cancel');
    expect(dom).toEqual({ lang: 'en-US', dir: 'ltr' });
    instance.dispose();
  });

  it('deduplicates concurrent intentions and reuses successful complete languages', async () => {
    const { instance, calls } = setup();
    const one = instance.changeLocale('en-US', []);
    const two = instance.changeLocale('en-US', ['feature']);
    const ensure = instance.ensureNamespaces(['app']);
    expect(calls).toHaveLength(1);
    calls[0].task.resolve(english);
    await Promise.all([one, two, ensure]);
    const chineseChange = instance.changeLocale('zh-CN', []);
    expect(calls).toHaveLength(2);
    expect(calls[1].locale).toBe('zh-CN');
    calls[1].task.resolve(chinese);
    await chineseChange;
    expect(instance.t('app:title', { name: 'Ada' })).toBe('入口 Ada');
    await instance.changeLocale('en-US', []);
    expect(instance.t('app:title', { name: 'Ada' })).toBe('Entry Ada');
    expect(calls).toHaveLength(2);
    instance.dispose();
  });

  it.each([
    ['missing namespace', { app: { title: 'Entry' } }],
    ['extra namespace', { ...english, extra: { title: 'unexpected' } }],
    ['public override', { ...english, common: { cancel: 'unexpected' } }],
    ['nested values', { app: { title: { nested: 'Entry' } }, feature: {} }],
    ['numeric values', { app: { count: 1 }, feature: {} }],
    ['null dictionary', { app: null, feature: {} }],
    ['array dictionary', { app: ['Entry'], feature: {} }],
    ['null language', null],
    ['array language', []],
  ])('rejects %s without installing partial dictionaries, then retries', async (_, payload) => {
    const { instance, calls, dom } = setup();
    const failed = instance.changeLocale('en-US', []);
    calls[0].task.resolve(payload as unknown as Messages);
    await expect(failed).rejects.toThrow();
    expect(instance.getSnapshot().activeLocale).toBe('zh-CN');
    expect(instance.getSnapshot().status).toBe('error');
    expect(instance.getResource('en-US', 'app')).toBeUndefined();
    expect(instance.getResource('en-US', 'feature')).toBeUndefined();
    expect(instance.i18n.hasResourceBundle('en-US', 'app')).toBe(false);
    expect(instance.t('common:cancel')).toBe('取消');
    expect(dom.lang).toBe('untouched');
    const retry = instance.changeLocale('en-US', []);
    expect(calls).toHaveLength(2);
    calls[1].task.resolve(english);
    await retry;
    expect(instance.t('feature:page./invite/:token')).toBe('Accept invitation');
    instance.dispose();
  });

  it('retries transport failures and accepts a synchronous loader throw as a rejected transition', async () => {
    let attempts = 0;
    const instance = createI18n({
      defaultLocale: 'en-US',
      appNamespaces: ['app'],
      loadMessages() {
        attempts++;
        if (attempts === 1) throw Error('synchronous failure');
        if (attempts === 2) return Promise.reject(Error('offline'));
        return Promise.resolve({ app: { title: 'Entry' } });
      },
    });
    await expect(instance.changeLocale('en-US', [])).rejects.toThrow('synchronous failure');
    await expect(instance.changeLocale('en-US', [])).rejects.toThrow('offline');
    await instance.changeLocale('en-US', []);
    expect(instance.t('app:title')).toBe('Entry');
    expect(attempts).toBe(3);
    instance.dispose();
  });

  it.each(['success', 'failure'] as const)('isolates a cancelled language and its late %s from a retry', async outcome => {
    const { instance, calls, dom } = setup();
    const obsolete = instance.changeLocale('en-US', []);
    const chineseChange = instance.changeLocale('zh-CN', []);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);
    const latest = instance.changeLocale('en-US', []);
    expect(calls[1].signal.aborted).toBe(true);
    expect(calls).toHaveLength(3);
    calls[2].task.resolve(english);
    await latest;
    if (outcome === 'success') calls[0].task.resolve({ ...english, app: { title: 'stale' } });
    else calls[0].task.reject(Error('late failure'));
    calls[1].task.resolve(chinese);
    await Promise.all([obsolete, chineseChange]);
    await flush();
    expect(instance.getSnapshot()).toEqual({ preferredLocale: 'en-US', activeLocale: 'en-US', status: 'ready' });
    expect(instance.t('app:title', { name: 'Ada' })).toBe('Entry Ada');
    expect(dom.lang).toBe('en-US');
    const retryChinese = instance.changeLocale('zh-CN', []);
    expect(calls).toHaveLength(4);
    calls[3].task.resolve(chinese);
    await retryChinese;
    expect(instance.t('app:title', { name: 'Ada' })).toBe('入口 Ada');
    instance.dispose();
  });

  it('aborts disposal without late SDK, DOM, or other instance mutation', async () => {
    const one = setup();
    const two = setup();
    let notifications = 0;
    one.instance.subscribe(() => notifications++);
    const disposedChange = one.instance.changeLocale('en-US', []);
    const otherChange = two.instance.changeLocale('en-US', []);
    const beforeDispose = notifications;
    one.instance.dispose();
    expect(one.calls[0].signal.aborted).toBe(true);
    expect(two.calls[0].signal.aborted).toBe(false);
    one.calls[0].task.resolve({ ...english, app: { title: 'late' } });
    two.calls[0].task.resolve(english);
    await Promise.all([disposedChange, otherChange]);
    expect(one.instance.i18n.hasResourceBundle('en-US', 'app')).toBe(false);
    expect(one.dom.lang).toBe('untouched');
    expect(notifications).toBe(beforeDispose);
    expect(two.instance.t('app:title', { name: 'Ada' })).toBe('Entry Ada');
    two.instance.i18n.addResourceBundle('en-US', 'app', { title: 'changed' }, true, true);
    expect(one.instance.getResource('en-US', 'app')).toBeUndefined();
    await expect(one.instance.changeLocale('en-US', [])).rejects.toThrow('disposed');
    two.instance.dispose();
  });

  it('copies validated resources so caller mutation cannot change cached language messages', async () => {
    const { instance, calls } = setup();
    const change = instance.changeLocale('en-US', []);
    const payload = { app: { title: 'Entry' }, feature: { title: 'Feature' } };
    calls[0].task.resolve(payload);
    await change;
    payload.app.title = 'changed';
    expect(instance.getResource('en-US', 'app')).toEqual({ title: 'Entry' });
    expect(instance.t('app:title')).toBe('Entry');
    instance.dispose();
  });

  it.each(['common', 'validation', 'shell', '', 'bad\0namespace'])('rejects invalid app namespace %j', namespace => {
    expect(() =>
      createI18n({ defaultLocale: 'en-US', appNamespaces: [namespace], loadMessages: async () => ({}) }),
    ).toThrow();
  });

  it('allows an app without app namespaces while retaining public loading', async () => {
    const instance = createI18n({
      defaultLocale: 'en-US',
      appNamespaces: [],
      loadMessages: async () => {
        throw Error('no app language should be requested');
      },
    });
    await instance.changeLocale('en-US', []);
    expect(instance.t('common:cancel')).toBe('Cancel');
    instance.dispose();
  });
});
