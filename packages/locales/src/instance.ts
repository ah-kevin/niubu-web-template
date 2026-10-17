import { createInstance, type i18n } from 'i18next';
import {
  createLocaleRuntime,
  type Locale,
  type LocaleRuntime,
  type LocaleDomTarget,
  type Resource,
} from '@niubu/hooks';
import { fallbackResources, publicNamespaces, type TranslationParams } from './fallback';
import { createLanguageMessages, type AppMessagesLoader } from './language-messages';
export type { TranslationParams } from './fallback';
export type { AppMessages, AppMessagesLoader } from './language-messages';
export type AppLoaders = Readonly<
  Record<
    string,
    {
      load(locale: Locale, signal: AbortSignal): Promise<Resource>;
      /** Bundled zh-CN resource, available before the first asynchronous request. */
      fallback: Resource;
    }
  >
>;
export type AppI18n = LocaleRuntime & {
  readonly i18n: i18n;
  readonly requiredNamespaces: readonly string[];
  t(key: string, params?: TranslationParams): string;
};
export type CreateI18nOptions = {
  defaultLocale: Locale;
  domTarget?: LocaleDomTarget;
} & (
  | { appLoaders: AppLoaders; appNamespaces?: never; loadMessages?: never }
  | { appLoaders?: never; appNamespaces: readonly string[]; loadMessages: AppMessagesLoader }
);
const publicLoaders = {
  'en-US': {
    common: () => import('./resources/en-US/common.json'),
    validation: () => import('./resources/en-US/validation.json'),
    shell: () => import('./resources/en-US/shell.json'),
  },
};
export function createI18n(options: CreateI18nOptions): AppI18n {
  if (options.appLoaders !== undefined && (options.appNamespaces !== undefined || options.loadMessages !== undefined))
    throw Error('App loaders and whole-language messages are mutually exclusive');
  const languageMessages = options.appNamespaces
    ? createLanguageMessages(options.appNamespaces, options.loadMessages)
    : undefined;
  const appLoaders = options.appLoaders ?? {};
  const fallback: Record<string, Resource> = Object.fromEntries(
    Object.entries(fallbackResources).map(([namespace, resource]) => [namespace, { ...resource }]),
  );
  for (const [namespace, loader] of Object.entries(appLoaders)) {
    if ((publicNamespaces as readonly string[]).includes(namespace))
      throw Error(`App cannot override public namespace: ${namespace}`);
    fallback[namespace] = { ...loader.fallback };
  }
  const namespaces = [...Object.keys(fallback), ...(languageMessages?.namespaces ?? [])];
  // No initReactI18next plugin: it registers a process-wide default instance.
  const owned = createInstance();
  void owned.init({
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    supportedLngs: ['zh-CN', 'en-US'],
    resources: { 'zh-CN': fallback },
    ns: namespaces,
    defaultNS: 'common',
    keySeparator: false,
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  const runtime = createLocaleRuntime({
    defaultLocale: options.defaultLocale,
    fallbackResources: fallback,
    domTarget: options.domTarget,
    async loadResource(locale, namespace, signal) {
      if (languageMessages?.namespaces.includes(namespace)) return languageMessages.load(locale, namespace, signal);
      const app = appLoaders[namespace];
      if (app) return app.load(locale, signal);
      if (!(publicNamespaces as readonly string[]).includes(namespace))
        throw Error(`Unknown locale namespace: ${namespace}`);
      if (locale === 'zh-CN') return fallbackResources[namespace as keyof typeof fallbackResources];
      const module = await publicLoaders['en-US'][namespace as keyof typeof fallbackResources]();
      if (signal.aborted) throw new DOMException('Locale resource aborted', 'AbortError');
      return module.default;
    },
  });
  const unsubscribe = runtime.subscribe(() => {
    const snapshot = runtime.getSnapshot();
    if (snapshot.status !== 'ready') return;
    for (const namespace of namespaces) {
      const resource = runtime.getResource(snapshot.activeLocale, namespace);
      if (resource) owned.addResourceBundle(snapshot.activeLocale, namespace, resource, true, true);
    }
    void owned.changeLanguage(snapshot.activeLocale);
  });
  return {
    ...runtime,
    i18n: owned,
    requiredNamespaces: Object.freeze(namespaces),
    changeLocale: (locale, required) => runtime.changeLocale(locale, [...namespaces, ...required]),
    ensureNamespaces: required => runtime.ensureNamespaces([...namespaces, ...required]),
    t(key, params) {
      const match = /^([\w.-]+):(.*)$/.exec(key);
      const namespace = match?.[1] ?? 'common';
      const resourceKey = match?.[2] ?? key;
      return String(
        owned.t(resourceKey, { ...params, ns: namespace, nsSeparator: false, lng: runtime.getSnapshot().activeLocale }),
      );
    },
    dispose() {
      unsubscribe();
      runtime.dispose();
      languageMessages?.dispose();
    },
  };
}
