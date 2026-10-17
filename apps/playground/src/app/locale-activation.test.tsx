import { act, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { createI18n } from '@niubu/locales';
import * as localeFactory from '../locales';
import appZh from '../locales/zh-CN/app.json';
import { startPlayground } from '../main';

it('keeps the newest language error when an older superseded completion arrives late', async () => {
  let releaseOld!: () => void;
  const oldCompletion = new Promise<void>(resolve => { releaseOld = resolve; });
  let englishLoads = 0;
  const factory = vi.spyOn(localeFactory, 'createPlaygroundI18n').mockImplementation((defaultLocale, domTarget) => {
    const instance = createI18n({
      defaultLocale,
      domTarget,
      appNamespaces: ['app'],
      loadMessages: async (locale, signal) => {
        if (locale === 'zh-CN') return { app: appZh };
        englishLoads++;
        if (englishLoads > 1) throw Error('Newest language unavailable');
        return new Promise<{ app: typeof appZh }>((_, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
        });
      },
    });
    const change = instance.changeLocale.bind(instance);
    let firstEnglish = true;
    instance.changeLocale = (locale, namespaces) => {
      const result = change(locale, namespaces);
      if (locale === 'en-US' && firstEnglish) {
        firstEnglish = false;
        return result.then(() => oldCompletion);
      }
      return result;
    };
    return instance;
  });
  const root = document.createElement('div');
  document.body.append(root);
  let runtime: Awaited<ReturnType<typeof startPlayground>> | undefined;
  try {
    await act(async () => {
      runtime = await startPlayground(root, {
        runtimeConfig: { schemaVersion: 1, apiURL: '/' },
        authStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        fetch: async () => new Response(JSON.stringify({ code: 0, data: [], message: 'ok' })),
        updateFetch: async () => new Response(null, { headers: { ETag: '"locale-unit"' } }),
        createRouter: routes => createMemoryRouter(routes, { initialEntries: ['/home'] }),
      });
    });
    const owner = runtime!;
    act(() => { owner.preferences.update({ locale: 'en-US' }); });
    await waitFor(() => expect(englishLoads).toBe(1));
    await act(async () => { owner.preferences.update({ locale: 'zh-CN' }); });
    await waitFor(() => expect(owner.i18n.getSnapshot().status).toBe('ready'));
    act(() => { owner.preferences.update({ locale: 'en-US' }); });
    await waitFor(() => expect(owner.stores.ui.getSnapshot().localeError).toBe('Preferred language unavailable'));
    await act(async () => { releaseOld(); });
    expect(owner.i18n.getSnapshot().activeLocale).toBe('zh-CN');
    expect(owner.stores.ui.getSnapshot().localeError).toBe('Preferred language unavailable');
  } finally {
    await act(async () => { releaseOld(); runtime?.dispose(); });
    factory.mockRestore();
    root.remove();
    localStorage.clear();
    sessionStorage.clear();
  }
});
