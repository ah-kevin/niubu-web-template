export type UpdateClock = {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};
export type UpdateSnapshot = Readonly<{
  status: 'idle' | 'checking' | 'current' | 'available' | 'unavailable';
  revision: string | null;
  errorCode?: string;
}>;
/** A public static HTML probe. It never uses the authenticated business client. */
export function createUpdateChecker({
  fetch: fetchIndex,
  indexURL,
  clock,
  intervalMs = 60_000,
}: {
  fetch: typeof fetch;
  indexURL: string;
  clock: UpdateClock;
  intervalMs?: number;
}) {
  type Validator = { etag: string | null; modified: string | null };
  type Flight = { controller: AbortController; promise: Promise<void> };
  let snapshot: UpdateSnapshot = Object.freeze({ status: 'idle', revision: null });
  let settled = snapshot;
  let baseline: Validator | null = null;
  let flight: Flight | undefined;
  let timer: unknown;
  let scheduled = false;
  let visible = true;
  let started = false;
  let disposed = false;
  const listeners = new Set<() => void>();
  const publish = (next: UpdateSnapshot) => {
    if (disposed) return;
    if (snapshot.status === next.status && snapshot.revision === next.revision && snapshot.errorCode === next.errorCode)
      return;
    snapshot = Object.freeze(next);
    if (next.status !== 'checking') settled = snapshot;
    listeners.forEach(listener => listener());
  };
  const fail = (errorCode: string) => {
    publish({
      status: snapshot.revision === null ? 'unavailable' : 'available',
      revision: snapshot.revision,
      errorCode,
    });
  };
  const clearTimer = () => {
    if (scheduled) clock.clearTimeout(timer);
    scheduled = false;
  };
  // Cancel even error/HEAD/late response bodies; no HTML bytes are consumed or hashed.
  const release = (response: Response) => {
    try {
      void response.body?.cancel().catch(() => {});
    } catch {
      // Body cleanup cannot turn a validator into an update or erase an existing fact.
    }
  };
  const resolveURL = () => {
    const page = globalThis.location;
    const url = new URL(indexURL, page?.href);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid-url');
    if (page && url.origin !== page.origin) throw new Error('cross-origin');
    return url;
  };
  const request = (url: URL, method: 'HEAD' | 'GET', signal: AbortSignal): Promise<Response> =>
    new Promise((resolve, reject) => {
      const abort = () => reject(new Error('aborted'));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        signal.removeEventListener('abort', abort);
        abort();
        return;
      }
      try {
        void fetchIndex(url.href, {
          method,
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          signal,
        }).then(
          response => {
            signal.removeEventListener('abort', abort);
            if (signal.aborted) release(response);
            else resolve(response);
          },
          () => {
            signal.removeEventListener('abort', abort);
            reject(new Error('network'));
          },
        );
      } catch {
        signal.removeEventListener('abort', abort);
        reject(new Error('network'));
      }
    });
  const probe = async (signal: AbortSignal) => {
    const url = resolveURL();
    const read = async (method: 'HEAD' | 'GET') => {
      const response = await request(url, method, signal);
      try {
        if (signal.aborted) throw new Error('aborted');
        if (response.url && new URL(response.url).origin !== url.origin) throw new Error('cross-origin');
        return {
          status: response.status,
          etag: response.headers.get('etag')?.trim() || null,
          modified: response.headers.get('last-modified')?.trim() || null,
        };
      } finally {
        release(response);
      }
    };
    let result = await read('HEAD');
    if (result.status === 405 || result.status === 501) result = await read('GET');
    return result;
  };
  const check = (): Promise<void> => {
    if (disposed || !visible) return Promise.resolve();
    if (flight) return flight.promise;
    started = true;
    clearTimer();
    const current: Flight = { controller: new AbortController(), promise: Promise.resolve() };
    const signal = current.controller.signal;
    flight = current;
    const active = () => !disposed && visible && flight === current && !signal.aborted;
    current.promise = probe(signal)
      .then(result => {
        if (!active()) return;
        if (result.status === 304) {
          publish(settled);
          return;
        }
        if (result.status < 200 || result.status >= 300) {
          fail(`http-${result.status}`);
          return;
        }
        if (!result.etag && !result.modified) {
          baseline = null;
          fail('missing-validator');
          return;
        }
        let revision: string | null = null;
        if (baseline?.etag && result.etag) {
          if (baseline.etag !== result.etag) revision = `etag:${result.etag}`;
        } else if (baseline?.modified && result.modified && baseline.modified !== result.modified) {
          revision = `last-modified:${result.modified}`;
        }
        baseline = { etag: result.etag, modified: result.modified };
        const availableRevision = revision ?? snapshot.revision;
        publish({ status: availableRevision === null ? 'current' : 'available', revision: availableRevision });
      })
      .catch((error: unknown) => {
        if (active()) fail(error instanceof Error ? error.message : 'network');
      })
      .finally(() => {
        if (!active()) return;
        settled = snapshot;
        flight = undefined;
        scheduled = true;
        timer = clock.setTimeout(() => {
          scheduled = false;
          void check();
        }, intervalMs);
      });
    if (snapshot.revision === null) publish({ status: 'checking', revision: null });
    return current.promise;
  };
  const stop = () => {
    clearTimer();
    const previous = flight;
    flight = undefined;
    previous?.controller.abort();
    if (snapshot.status === 'checking') publish(settled);
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (!disposed) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    check,
    setVisible(next: boolean) {
      if (disposed) return;
      const wasVisible = visible;
      visible = next;
      if (!visible) stop();
      else if (!wasVisible || !started) void check();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      listeners.clear();
    },
  };
}
export type UpdateChecker = ReturnType<typeof createUpdateChecker>;
