import { describe, expect, it } from 'vitest';
import { createLocaleRuntime, type Locale, type Resource } from './locale';
function deferred() {
  let resolve!: (value: Resource) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Resource>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup(defaultLocale: Locale = 'zh-CN') {
  const calls: { locale: Locale; ns: string; signal: AbortSignal; task: ReturnType<typeof deferred> }[] = [];
  const dom = { lang: 'untouched', dir: 'untouched' };
  const runtime = createLocaleRuntime({
    defaultLocale,
    fallbackResources: { common: { label: '中文' }, app: { label: '入口' } },
    domTarget: dom,
    loadResource(locale, ns, signal) {
      const task = deferred();
      calls.push({ locale, ns, signal, task });
      return task.promise;
    },
  });
  return { runtime, calls, dom };
}
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
describe('locale intention and atomic activation', () => {
  it('deduplicates resources and waits for every namespace before touching DOM', async () => {
    const { runtime, calls, dom } = setup();
    const change = runtime.changeLocale('en-US', ['common', 'common']);
    const ensure = runtime.ensureNamespaces(['common', 'app']);
    expect(calls).toHaveLength(2);
    expect(runtime.getSnapshot()).toEqual({ preferredLocale: 'en-US', activeLocale: 'zh-CN', status: 'loading' });
    calls[0].task.resolve({ label: 'English' });
    await flush();
    expect(dom.lang).toBe('untouched');
    expect(runtime.getSnapshot().activeLocale).toBe('zh-CN');
    calls[1].task.resolve({ label: 'Entry' });
    await Promise.all([change, ensure]);
    expect(runtime.getSnapshot().status).toBe('ready');
    expect(dom).toEqual({ lang: 'en-US', dir: 'ltr' });
    await runtime.ensureNamespaces(['app']);
    expect(calls).toHaveLength(2);
  });
  it('ignores late successes and errors from obsolete generations', async () => {
    const { runtime, calls, dom } = setup();
    const old = runtime.changeLocale('en-US', ['extra']);
    const next = runtime.changeLocale('zh-CN', ['extra']);
    expect(calls[0].signal.aborted).toBe(true);
    calls[1].task.resolve({ label: '新的中文' });
    await next;
    calls[0].task.reject(Error('late error'));
    await old;
    await flush();
    expect(runtime.getSnapshot()).toEqual({ preferredLocale: 'zh-CN', activeLocale: 'zh-CN', status: 'ready' });
    expect(dom.lang).toBe('zh-CN');
    const stale = runtime.changeLocale('en-US', ['other']);
    const latest = runtime.changeLocale('zh-CN', ['other']);
    calls.at(-1)!.task.resolve({ label: '最终中文' });
    await latest;
    calls.at(-2)!.task.resolve({ label: 'late English' });
    await stale;
    expect(runtime.getSnapshot().activeLocale).toBe('zh-CN');
  });
  it('keeps the previous language on failure and retries rejected loads', async () => {
    const { runtime, calls } = setup();
    const failed = runtime.changeLocale('en-US', ['common']);
    calls[0].task.reject(Error('unavailable'));
    await expect(failed).rejects.toThrow('unavailable');
    expect(runtime.getSnapshot()).toEqual({ preferredLocale: 'en-US', activeLocale: 'zh-CN', status: 'error' });
    const retry = runtime.changeLocale('en-US', ['common']);
    calls[1].task.resolve({ label: 'English' });
    await retry;
    expect(runtime.getSnapshot().activeLocale).toBe('en-US');
  });
  it('first failure retains bundled zh-CN including app fallback', async () => {
    const { runtime, calls, dom } = setup('en-US');
    const failed = runtime.changeLocale('en-US', ['common', 'app']);
    calls[0].task.reject(Error('offline'));
    calls[1].task.resolve({ label: 'Entry' });
    await expect(failed).rejects.toThrow('offline');
    expect(runtime.getSnapshot().activeLocale).toBe('zh-CN');
    expect(runtime.getSnapshot().preferredLocale).toBe('en-US');
    expect(runtime.getResource('zh-CN', 'app')?.label).toBe('入口');
    expect(dom.lang).toBe('untouched');
  });
  it('ensure on active locale cannot commit a partially ready switch', async () => {
    const { runtime, calls } = setup();
    await runtime.ensureNamespaces(['common']);
    const change = runtime.changeLocale('en-US', ['common']);
    const ensure = runtime.ensureNamespaces(['app']);
    calls[0].task.resolve({ label: 'English' });
    await flush();
    expect(runtime.getSnapshot().activeLocale).toBe('zh-CN');
    calls[1].task.resolve({ label: 'Entry' });
    await Promise.all([change, ensure]);
    expect(runtime.getResource('en-US', 'app')).toEqual({ label: 'Entry' });
  });
  it('separates cache and subscriptions between instances', async () => {
    const one = setup(),
      two = setup();
    let notified = 0;
    two.runtime.subscribe(() => notified++);
    const change = one.runtime.changeLocale('en-US', ['common']);
    one.calls[0].task.resolve({ label: 'one' });
    await change;
    expect(two.runtime.getSnapshot().activeLocale).toBe('zh-CN');
    expect(two.calls).toHaveLength(0);
    expect(notified).toBe(0);
  });
  it('dispose aborts and settles pending work without later listener or DOM effects', async () => {
    const { runtime, calls, dom } = setup();
    let notified = 0;
    runtime.subscribe(() => notified++);
    const change = runtime.changeLocale('en-US', ['common']);
    const before = notified;
    runtime.dispose();
    expect(calls[0].signal.aborted).toBe(true);
    await change;
    calls[0].task.resolve({ label: 'late' });
    await flush();
    expect(notified).toBe(before);
    expect(dom.lang).toBe('untouched');
    await expect(runtime.ensureNamespaces(['app'])).rejects.toThrow('disposed');
  });
  it('propagates appended namespace failure without silently retrying within the generation', async () => {
    const { runtime, calls } = setup();
    const change = runtime.changeLocale('en-US', ['common']);
    const ensure = runtime.ensureNamespaces(['app']);
    calls[1].task.reject(Error('app failed'));
    await flush();
    calls[0].task.resolve({ label: 'English' });
    await expect(change).rejects.toThrow('app failed');
    await expect(ensure).rejects.toThrow('app failed');
    expect(calls).toHaveLength(2);
    expect(runtime.getSnapshot().activeLocale).toBe('zh-CN');
  });
});
it.each(['success', 'error'] as const)('keeps final English activation after stale Chinese %s', async outcome => {
  const { runtime, calls, dom } = setup();
  const stale = runtime.changeLocale('zh-CN', ['extra']);
  const latest = runtime.changeLocale('en-US', ['extra']);
  calls[1].task.resolve({ label: 'Final English' });
  await latest;
  if (outcome === 'success') calls[0].task.resolve({ label: '迟到中文' });
  else calls[0].task.reject(Error('迟到失败'));
  await stale;
  await flush();
  expect(runtime.getSnapshot()).toEqual({ preferredLocale: 'en-US', activeLocale: 'en-US', status: 'ready' });
  expect(dom).toEqual({ lang: 'en-US', dir: 'ltr' });
});
it('deduplicates overlapping change intentions in the same locale', async () => {
  const { runtime, calls } = setup();
  const one = runtime.changeLocale('en-US', ['common']);
  const two = runtime.changeLocale('en-US', ['common']);
  expect(calls).toHaveLength(1);
  calls[0].task.resolve({ label: 'English' });
  await Promise.all([one, two]);
  expect(runtime.getSnapshot().activeLocale).toBe('en-US');
});
