import { type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { createStoragePort } from '@niubu/hooks';
import { createI18n } from '@niubu/locales';
import { I18nProvider } from '@niubu/locales/react';
import { afterEach } from 'vitest';

const disposals: Array<() => void> = [];
afterEach(() =>
  disposals
    .splice(0)
    .reverse()
    .forEach(dispose => dispose()),
);
export function makeManager(identityKey = 'fixture') {
  const manager = createPreferenceManager({
    identity: { product: 'fixture', storageNamespace: 'fixture', appId: 'tools', environment: 'test', identityKey },
    storage: createStoragePort({ getItem: () => null, setItem: () => {} }),
  });
  disposals.push(manager.dispose);
  return manager;
}
export async function renderWidgets(children: ReactNode, manager = makeManager()) {
  const i18n = createI18n({ defaultLocale: 'en-US', appLoaders: {} });
  await i18n.changeLocale('en-US', i18n.requiredNamespaces);
  const scene = (value: ReactNode) => (
    <PreferenceProvider manager={manager}>
      <I18nProvider instance={i18n}>{value}</I18nProvider>
    </PreferenceProvider>
  );
  const view = render(scene(children));
  disposals.push(() => {
    view.unmount();
    i18n.dispose();
  });
  return { ...view, manager, rerender: (value: ReactNode) => view.rerender(scene(value)) };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
