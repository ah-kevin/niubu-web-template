import { act, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { preferenceStorageKey } from '@niubu/preferences';
import { appIdentity } from './app/config';
import { startPlayground } from './main';

// Exercise failure at the asynchronous resource boundary; public owners remain real.
vi.mock('./locales/en-US/app.json', () => {
  throw Error('App English resource is unavailable');
});

it('keeps the bundled Chinese home usable when preferred English cannot load', async () => {
  localStorage.setItem(
    preferenceStorageKey(appIdentity),
    JSON.stringify({
      schemaVersion: 1,
      core: { locale: 'en-US' },
      extensions: {},
      migrations: [],
    }),
  );
  const root = document.createElement('div');
  document.body.append(root);
  let runtime!: Awaited<ReturnType<typeof startPlayground>>;
  try {
    await act(async () => {
      runtime = await startPlayground(root, { runtimeConfig: {schemaVersion:1,apiURL:'/'},
        createRouter: routes => createMemoryRouter(routes, { initialEntries: ['/home'] }),
        fetch: async input =>
          new Response(
            JSON.stringify({
              code: 0,
              data: String(input).endsWith('/api/menu') ? [{kind:'page',id:'home',pageId:'playground.home'}] : { status: 'ok' },
              message: 'ok',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      });
    });
    expect(await screen.findByRole('heading', { name: '公共首页' })).toBeVisible();
    expect(await screen.findByText('首选语言暂不可用，已保留当前语言。')).toBeVisible();
    expect(runtime.preferences.getSnapshot().core.locale).toBe('en-US');
    expect(runtime.i18n.getSnapshot().activeLocale).toBe('zh-CN');
  } finally {
    await act(async () => runtime?.dispose());
    root.remove();
    localStorage.clear();
  }
});
