export type Locale = 'zh-CN' | 'en-US';
export type Resource = Readonly<Record<string, string>>;
export type ResourceLoader = (locale: Locale, namespace: string, signal: AbortSignal) => Promise<Resource>;
export type LocaleSnapshot = Readonly<{
  preferredLocale: Locale;
  activeLocale: Locale;
  status: 'ready' | 'loading' | 'error';
}>;
export type LocaleDomTarget = { lang: string; dir: string };
export type LocaleRuntime = {
  getSnapshot(): LocaleSnapshot;
  subscribe(listener: () => void): () => void;
  changeLocale(locale: Locale, namespaces: readonly string[]): Promise<void>;
  ensureNamespaces(namespaces: readonly string[]): Promise<void>;
  getResource(locale: Locale, namespace: string): Resource | undefined;
  dispose(): void;
};
export type LocaleRuntimeOptions = {
  defaultLocale: Locale;
  loadResource: ResourceLoader;
  fallbackResources: Readonly<Record<string, Resource>>;
  domTarget?: LocaleDomTarget;
};
/** Per-owner async resource state; no catalog, storage, or implicit DOM ownership. */
export function createLocaleRuntime(options: LocaleRuntimeOptions): LocaleRuntime {
  let snapshot: LocaleSnapshot = Object.freeze({
    preferredLocale: options.defaultLocale,
    activeLocale: 'zh-CN',
    status: 'ready',
  });
  let disposed = false;
  let generation = 0;
  const listeners = new Set<() => void>();
  const resources = new Map<string, Resource>();
  const pending = new Map<string, { controller: AbortController; promise: Promise<Resource> }>();
  const required = new Set<string>();
  type Transition = {
    generation: number;
    locale: Locale;
    namespaces: Set<string>;
    requests: Map<string, Promise<Resource>>;
    promise: Promise<void>;
  };
  let transition: Transition | undefined;
  const key = (locale: Locale, namespace: string) => `${locale}\0${namespace}`;
  for (const [namespace, resource] of Object.entries(options.fallbackResources))
    resources.set(key('zh-CN', namespace), Object.freeze({ ...resource }));
  function publish(next: LocaleSnapshot) {
    snapshot = Object.freeze(next);
    for (const listener of listeners) listener();
  }
  function load(locale: Locale, namespace: string): Promise<Resource> {
    const id = key(locale, namespace);
    const cached = resources.get(id);
    if (cached) return Promise.resolve(cached);
    const inflight = pending.get(id);
    if (inflight) return inflight.promise;
    const controller = new AbortController();
    let rejectAbort!: (error: Error) => void;
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = reject;
    });
    const abort = () => rejectAbort(new DOMException('Locale resource aborted', 'AbortError'));
    controller.signal.addEventListener('abort', abort, { once: true });
    let result: Promise<Resource>;
    try {
      result = options.loadResource(locale, namespace, controller.signal);
    } catch (error) {
      result = Promise.reject(error);
    }
    const request = { controller, promise: Promise.resolve({} as Resource) };
    request.promise = Promise.race([result, aborted])
      .then(resource => {
        if (controller.signal.aborted || disposed) throw new DOMException('Locale resource aborted', 'AbortError');
        const ready = Object.freeze({ ...resource });
        resources.set(id, ready);
        return ready;
      })
      .finally(() => {
        controller.signal.removeEventListener('abort', abort);
        if (pending.get(id) === request) pending.delete(id);
      });
    pending.set(id, request);
    return request.promise;
  }
  function abortExcept(locale: Locale, namespaces: Set<string>) {
    for (const [id, request] of pending) {
      const [requestLocale, namespace] = id.split('\0');
      if (requestLocale !== locale || !namespaces.has(namespace)) {
        pending.delete(id);
        request.controller.abort();
      }
    }
  }
  function addNamespaces(namespaces: readonly string[]) {
    for (const namespace of namespaces) {
      if (!namespace || namespace.includes('\0')) throw Error('Invalid locale namespace');
      required.add(namespace);
    }
  }
  function request(current: Transition, namespace: string) {
    let promise = current.requests.get(namespace);
    if (!promise) {
      promise = load(current.locale, namespace);
      current.requests.set(namespace, promise);
    }
    return promise;
  }
  function start(locale: Locale): Promise<void> {
    const current: Transition = {
      generation: ++generation,
      locale,
      namespaces: new Set(required),
      requests: new Map(),
      promise: Promise.resolve(),
    };
    transition = current;
    abortExcept(locale, current.namespaces);
    publish({ ...snapshot, status: 'loading' });
    const run = async () => {
      try {
        // ensureNamespaces may add requirements while these loads are pending.
        let loaded = -1;
        while (loaded !== current.namespaces.size) {
          loaded = current.namespaces.size;
          await Promise.all([...current.namespaces].map(namespace => request(current, namespace)));
        }
        if (disposed || current.generation !== generation) return;
        if (options.domTarget) {
          options.domTarget.lang = locale;
          options.domTarget.dir = 'ltr';
        }
        transition = undefined;
        publish({ ...snapshot, activeLocale: locale, status: 'ready' });
      } catch (error) {
        if (disposed || current.generation !== generation) return;
        transition = undefined;
        // A failed request can be retried; pending siblings must not hang forever.
        for (const [id, request] of pending)
          if (id.startsWith(`${locale}\0`)) {
            pending.delete(id);
            request.controller.abort();
          }
        publish({ ...snapshot, status: 'error' });
        throw error;
      }
    };
    current.promise = run();
    return current.promise;
  }
  return {
    getSnapshot: () => snapshot,
    getResource: (locale, namespace) => resources.get(key(locale, namespace)),
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async changeLocale(locale, namespaces) {
      if (disposed) throw Error('Locale runtime disposed');
      if (locale !== 'zh-CN' && locale !== 'en-US') throw Error('Unsupported locale');
      addNamespaces(namespaces);
      snapshot = Object.freeze({ ...snapshot, preferredLocale: locale });
      await start(locale);
    },
    async ensureNamespaces(namespaces) {
      if (disposed) throw Error('Locale runtime disposed');
      addNamespaces(namespaces);
      if (transition) {
        for (const namespace of required) transition.namespaces.add(namespace);
        // Start appended requests immediately, preserving instance-wide deduplication.
        for (const namespace of transition.namespaces) void request(transition, namespace).catch(() => {});
        await transition.promise;
      } else await start(snapshot.activeLocale);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      listeners.clear();
      for (const request of pending.values()) request.controller.abort();
      pending.clear();
      transition = undefined;
    },
  };
}
