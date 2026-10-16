import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUpdateChecker, type UpdateClock } from './check-updates';

const indexURL = 'https://app.example.test/base/index.html';
const modified = 'Thu, 15 Oct 2026 00:00:00 GMT';
const later = 'Fri, 16 Oct 2026 00:00:00 GMT';
function clock() {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    setTimeout(callback: () => void, ms: number) {
      timers.set(++id, { at: now + ms, callback });
      return id;
    },
    clearTimeout(handle: unknown) {
      timers.delete(handle as number);
    },
    advance(ms: number) {
      now += ms;
      for (const [key, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(key);
          timer.callback();
        }
      }
    },
    count: () => timers.size,
  } satisfies UpdateClock & { advance(ms: number): void; count(): number };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function response(headers: HeadersInit = {}, status = 200) {
  return new Response(status === 304 ? null : 'ignored HTML', { status, headers });
}
const owners: ReturnType<typeof createUpdateChecker>[] = [];
function setup(responses: Response[] = [], intervalMs?: number) {
  const time = clock();
  const fetcher = vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error('No injected response');
    return next;
  });
  const checker = createUpdateChecker({ fetch: fetcher, indexURL, clock: time, intervalMs });
  owners.push(checker);
  return { checker, time, fetcher };
}
afterEach(() => {
  owners.splice(0).forEach(owner => owner.dispose());
  vi.unstubAllGlobals();
});

describe('static index update checker', () => {
  it('establishes the first validator baseline, prefers shared ETags and deduplicates an available revision', async () => {
    const { checker } = setup([
      response({ ETag: '"a"', 'Last-Modified': modified }),
      response({ ETag: '"a"', 'Last-Modified': later }),
      response({ ETag: '"b"', 'Last-Modified': later }),
      response({ ETag: '"b"', 'Last-Modified': later }),
    ]);
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'current', revision: null });
    await checker.check();
    expect(checker.getSnapshot().status).toBe('current');
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'available', revision: 'etag:"b"' });
    const available = checker.getSnapshot();
    const listener = vi.fn();
    checker.subscribe(listener);
    await checker.check();
    expect(checker.getSnapshot()).toBe(available);
    expect(listener).not.toHaveBeenCalled();
  });

  it('compares shared Last-Modified when both ETags are not present', async () => {
    const { checker } = setup([
      response({ ETag: '"a"', 'Last-Modified': modified }),
      response({ 'Last-Modified': later }),
    ]);
    await checker.check();
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'available', revision: `last-modified:${later}` });
  });

  it('rebuilds incomparable baselines without claiming a new version', async () => {
    const { checker } = setup([
      response({ ETag: '"a"' }),
      response({ 'Last-Modified': modified }),
      response({ 'Last-Modified': modified }),
      response(),
      response({ ETag: '"b"' }),
    ]);
    await checker.check();
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'current', revision: null });
    await checker.check();
    expect(checker.getSnapshot().status).toBe('current');
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'unavailable', revision: null, errorCode: 'missing-validator' });
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'current', revision: null });
  });

  it('does not manufacture a baseline from 304 and preserves settled state on subsequent 304s', async () => {
    const { checker } = setup([
      response({ ETag: '"invented"' }, 304),
      response({ ETag: '"a"' }),
      response({}, 304),
      response({ ETag: '"b"' }),
      response({}, 304),
    ]);
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'idle', revision: null });
    await checker.check();
    const current = checker.getSnapshot();
    await checker.check();
    expect(checker.getSnapshot()).toEqual(current);
    await checker.check();
    const available = checker.getSnapshot();
    await checker.check();
    expect(checker.getSnapshot()).toBe(available);
  });

  it.each([405, 501])('falls back to GET only for HEAD %i and releases both bodies', async status => {
    const head = response({}, status);
    const get = response({ ETag: '"a"' });
    const cancelHead = vi.spyOn(head.body!, 'cancel');
    const cancelGet = vi.spyOn(get.body!, 'cancel');
    const { checker, fetcher } = setup([head, get]);
    await checker.check();
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(['HEAD', 'GET']);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe(indexURL);
      expect(init).toMatchObject({ cache: 'no-store', credentials: 'omit', redirect: 'error' });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
    }
    expect(cancelHead).toHaveBeenCalledOnce();
    expect(cancelGet).toHaveBeenCalledOnce();
    expect(checker.getSnapshot().status).toBe('current');
  });

  it.each([401, 403, 404, 500, 302])('does not retry HEAD %i as GET', async status => {
    const result = response({}, status);
    const cancel = vi.spyOn(result.body!, 'cancel');
    const { checker, fetcher } = setup([result]);
    await checker.check();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(checker.getSnapshot()).toMatchObject({ status: 'unavailable', revision: null });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('keeps an available fact through missing headers, network and HTTP failure, then recovers', async () => {
    const { checker, fetcher } = setup([response({ ETag: '"a"' }), response({ ETag: '"b"' })]);
    await checker.check();
    await checker.check();
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'available', revision: 'etag:"b"', errorCode: 'network' });
    fetcher.mockResolvedValueOnce(response({}, 503));
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'available', revision: 'etag:"b"', errorCode: 'http-503' });
    fetcher.mockResolvedValueOnce(response());
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'available', revision: 'etag:"b"', errorCode: 'missing-validator' });
    fetcher.mockResolvedValueOnce(response({ ETag: '"b"' }));
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'available', revision: 'etag:"b"' });
  });

  it('serializes default 60s polling from settlement and merges manual checks with the flight', async () => {
    const pending = deferred<Response>();
    const { checker, time, fetcher } = setup();
    fetcher.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response({ ETag: '"a"' }));
    const first = checker.check();
    expect(checker.check()).toBe(first);
    expect(checker.getSnapshot().status).toBe('checking');
    expect(fetcher).toHaveBeenCalledOnce();
    time.advance(120_000);
    expect(fetcher).toHaveBeenCalledOnce();
    pending.resolve(response({ ETag: '"a"' }));
    await first;
    expect(time.count()).toBe(1);
    time.advance(59_999);
    expect(fetcher).toHaveBeenCalledOnce();
    time.advance(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await checker.check();
    expect(time.count()).toBe(1);
  });

  it('supports an injected interval and clears a scheduled timer when hidden', async () => {
    const { checker, time, fetcher } = setup([response({ ETag: '"a"' })], 25);
    await checker.check();
    time.advance(24);
    expect(fetcher).toHaveBeenCalledOnce();
    checker.setVisible(false);
    expect(time.count()).toBe(0);
    time.advance(100);
    await checker.check();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('aborts and settles hidden flight, ignores and releases its late response, and resumes immediately once', async () => {
    const pending = deferred<Response>();
    const { checker, time, fetcher } = setup();
    fetcher.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response({ ETag: '"new"' }));
    const first = checker.check();
    const signal = fetcher.mock.calls[0]![1]!.signal!;
    checker.setVisible(false);
    expect(signal.aborted).toBe(true);
    await first;
    expect(checker.getSnapshot()).toEqual({ status: 'idle', revision: null });
    checker.setVisible(true);
    checker.setVisible(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await checker.check();
    const settled = checker.getSnapshot();
    const lateResponse = response({ ETag: '"old"' });
    const cancel = vi.spyOn(lateResponse.body!, 'cancel');
    pending.resolve(lateResponse);
    await pending.promise;
    expect(checker.getSnapshot()).toBe(settled);
    expect(cancel).toHaveBeenCalledOnce();
    expect(time.count()).toBe(1);
  });

  it('disposes idempotently without publishing, polling, or admitting late results', async () => {
    const pending = deferred<Response>();
    const { checker, time, fetcher } = setup();
    fetcher.mockReturnValueOnce(pending.promise);
    const first = checker.check();
    const listener = vi.fn();
    checker.subscribe(listener);
    checker.dispose();
    checker.dispose();
    expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    await first;
    pending.resolve(response({ ETag: '"late"' }));
    await pending.promise;
    checker.setVisible(true);
    await checker.check();
    time.advance(120_000);
    expect(listener).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(time.count()).toBe(0);
  });

  it('rejects a cross-origin final response and releases its body without comparing validators', async () => {
    const foreign = response({ ETag: '"foreign"' });
    Object.defineProperty(foreign, 'url', { value: 'https://other.example.test/index.html' });
    const cancel = vi.spyOn(foreign.body!, 'cancel');
    const { checker } = setup([foreign]);
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'unavailable', revision: null, errorCode: 'cross-origin' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects a configured URL outside the current page origin before fetch', async () => {
    vi.stubGlobal('location', { href: indexURL, origin: new URL(indexURL).origin });
    const fetcher = vi.fn<typeof fetch>();
    const checker = createUpdateChecker({ fetch: fetcher, indexURL: 'https://other.example.test/index.html', clock: clock() });
    owners.push(checker);
    await checker.check();
    expect(fetcher).not.toHaveBeenCalled();
    expect(checker.getSnapshot()).toEqual({ status: 'unavailable', revision: null, errorCode: 'cross-origin' });
  });

  it('cleans unsubscribe independently and starts only one visible check', async () => {
    const { checker, fetcher } = setup([response({ ETag: '"a"' })]);
    const listener = vi.fn();
    const off = checker.subscribe(listener);
    off();
    off();
    checker.setVisible(true);
    checker.setVisible(true);
    await checker.check();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(listener).not.toHaveBeenCalled();
  });

  it('merges a manual check made by a checking subscriber into the same settlement promise', async () => {
    const pending = deferred<Response>();
    const { checker, fetcher } = setup();
    fetcher.mockReturnValueOnce(pending.promise);
    let joined: Promise<void> | undefined;
    checker.subscribe(() => {
      if (checker.getSnapshot().status === 'checking') joined = checker.check();
    });
    const first = checker.check();
    expect(joined).toBe(first);
    pending.resolve(response({ ETag: '"a"' }));
    await first;
    expect(checker.getSnapshot().status).toBe('current');
  });

  it('retains a just-published available fact when a subscriber hides the page before finalization', async () => {
    const { checker, fetcher } = setup([response({ ETag: '"a"' }), response({ ETag: '"b"' })]);
    await checker.check();
    const off = checker.subscribe(() => {
      if (checker.getSnapshot().status === 'available') checker.setVisible(false);
    });
    await checker.check();
    off();
    fetcher.mockResolvedValueOnce(response({}, 304));
    checker.setVisible(true);
    await checker.check();
    expect(checker.getSnapshot()).toEqual({ status: 'available', revision: 'etag:"b"' });
  });
});
