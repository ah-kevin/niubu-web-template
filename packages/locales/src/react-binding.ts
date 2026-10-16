import { useContext, useMemo, useSyncExternalStore } from 'react';
import type { Resource } from '@niubu/hooks';
import { translateFallback, type TranslationParams } from './fallback';
import { I18nContext as Context } from './react-context';
const standaloneSnapshot = Object.freeze({
  preferredLocale: 'zh-CN' as const,
  activeLocale: 'zh-CN' as const,
  status: 'ready' as const,
});
const standaloneSubscribe = () => () => {};
const getStandaloneSnapshot = () => standaloneSnapshot;

/** Every binding uses the explicit owner. Standalone pattern fixtures use plain zh-CN resources. */
export function useTranslation(namespace = 'common', appFallback?: Resource) {
  const instance = useContext(Context);
  const snapshot = useSyncExternalStore(
    instance?.subscribe ?? standaloneSubscribe,
    instance?.getSnapshot ?? getStandaloneSnapshot,
    instance?.getSnapshot ?? getStandaloneSnapshot,
  );
  const locale = snapshot.activeLocale;
  const binding = useMemo(() => {
    const qualify = (key: string) => (/^[\w.-]+:/.test(key) ? key : `${namespace}:${key}`);
    return {
      locale,
      t: (key: string, params?: TranslationParams) =>
        instance ? instance.t(qualify(key), params) : translateFallback(qualify(key), params, appFallback),
    };
  }, [locale, instance, namespace, appFallback]);
  return { ...binding, snapshot };
}
