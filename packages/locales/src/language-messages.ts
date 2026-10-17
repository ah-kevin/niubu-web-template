import type { Locale, Resource } from '@niubu/hooks';
import { publicNamespaces } from './fallback';

export type AppMessages = Readonly<Record<string, Resource>>;
export type AppMessagesLoader = (locale: Locale, signal: AbortSignal) => Promise<AppMessages>;

function aborted() {
  return new DOMException('Locale messages aborted', 'AbortError');
}
function isDictionary(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Adapts complete app languages to the runtime's per-namespace preparation. */
export function createLanguageMessages(appNamespaces: readonly string[], loadMessages: AppMessagesLoader) {
  const namespaces = Object.freeze([...new Set(appNamespaces)]);
  for (const namespace of namespaces) {
    if (!namespace || namespace.includes('\0')) throw Error('Invalid locale namespace');
    if ((publicNamespaces as readonly string[]).includes(namespace))
      throw Error(`App cannot override public namespace: ${namespace}`);
  }
  const registered = new Set(namespaces);
  const cache = new Map<Locale, AppMessages>();
  type Request = {
    controller: AbortController;
    consumers: Set<AbortSignal>;
    promise: Promise<AppMessages>;
  };
  const pending = new Map<Locale, Request>();
  let disposed = false;

  function validate(value: unknown): AppMessages {
    if (!isDictionary(value)) throw Error('Invalid app locale messages');
    for (const namespace of Object.keys(value)) {
      if ((publicNamespaces as readonly string[]).includes(namespace))
        throw Error(`App cannot override public namespace: ${namespace}`);
      if (!registered.has(namespace)) throw Error(`Unexpected app locale namespace: ${namespace}`);
    }
    const entries = namespaces.map(namespace => {
      if (!Object.hasOwn(value, namespace)) throw Error(`Missing app locale namespace: ${namespace}`);
      const resource = value[namespace];
      if (!isDictionary(resource) || Object.values(resource).some(message => typeof message !== 'string'))
        throw Error(`Invalid app locale resource: ${namespace}`);
      return [namespace, Object.freeze({ ...resource })] as const;
    });
    return Object.freeze(Object.fromEntries(entries)) as AppMessages;
  }

  function start(locale: Locale): Request {
    const controller = new AbortController();
    let rejectAbort!: (error: Error) => void;
    const abortPromise = new Promise<never>((_, reject) => {
      rejectAbort = reject;
    });
    const onAbort = () => rejectAbort(aborted());
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const request: Request = { controller, consumers: new Set(), promise: Promise.resolve({}) };
    pending.set(locale, request);
    let result: Promise<AppMessages>;
    try {
      result = loadMessages(locale, controller.signal);
    } catch (error) {
      result = Promise.reject(error);
    }
    request.promise = Promise.race([result, abortPromise])
      .then(value => {
        if (disposed || controller.signal.aborted) throw aborted();
        const messages = validate(value);
        cache.set(locale, messages);
        return messages;
      })
      .finally(() => {
        controller.signal.removeEventListener('abort', onAbort);
        if (pending.get(locale) === request) pending.delete(locale);
      });
    return request;
  }

  return {
    namespaces,
    async load(locale: Locale, namespace: string, signal: AbortSignal): Promise<Resource> {
      if (disposed || signal.aborted) throw aborted();
      const cached = cache.get(locale);
      if (cached) return cached[namespace];
      const request = pending.get(locale) ?? start(locale);
      request.consumers.add(signal);
      const onAbort = () => {
        request.consumers.delete(signal);
        if (request.consumers.size === 0) {
          if (pending.get(locale) === request) pending.delete(locale);
          request.controller.abort();
        }
      };
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        const messages = await request.promise;
        if (disposed || signal.aborted) throw aborted();
        return messages[namespace];
      } finally {
        signal.removeEventListener('abort', onAbort);
        request.consumers.delete(signal);
      }
    },
    dispose() {
      disposed = true;
      for (const request of pending.values()) request.controller.abort();
      pending.clear();
      cache.clear();
    },
  };
}
