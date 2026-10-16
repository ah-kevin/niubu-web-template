import type { Resource } from '@niubu/hooks';
import commonZh from './resources/zh-CN/common.json';
import validationZh from './resources/zh-CN/validation.json';
import shellZh from './resources/zh-CN/shell.json';

export const publicNamespaces = ['common', 'validation', 'shell'] as const;
export const fallbackResources = Object.freeze({ common: commonZh, validation: validationZh, shell: shellZh });
export type TranslationParams = Readonly<Record<string, string | number>>;

/** Stateless fallback for standalone patterns; it never constructs an i18next instance. */
export function translateFallback(key: string, params: TranslationParams = {}, appFallback?: Resource): string {
  const separator = key.indexOf(':');
  const namespace = separator < 0 ? 'common' : key.slice(0, separator);
  const resourceKey = separator < 0 ? key : key.slice(separator + 1);
  const resource = (publicNamespaces as readonly string[]).includes(namespace)
    ? fallbackResources[namespace as keyof typeof fallbackResources]
    : appFallback;
  const value = (resource as Resource | undefined)?.[resourceKey] ?? key;
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (slot, name: string) =>
    params[name] === undefined ? slot : String(params[name]),
  );
}
