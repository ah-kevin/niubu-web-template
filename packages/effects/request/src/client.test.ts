import { describe, expect, it, vi } from 'vitest';
import { createRequestClient } from './client';
import { createDisabledRequestClient } from './disabled';
import { deferred, fakeClient, spec } from './test-helpers';
import { isAccessExpired } from './protocol';

describe('injected request outcomes', () => {
  it.each(['caller-abort', 'dispose', 'generation-change'] as const)(
    'rejects a queued success when %s occurs in the final publication window',
    async kind => {
      const controller = new AbortController();
      let generation = 1;
      let invalidated = false;
      const injected = vi.fn(async () => Response.json({ code: 0, data: 7, message: 'ok' }));
      const renew = vi.fn();
      const { client, activityReporter, credentialsProvider } = fakeClient({
        fetch: injected,
        getGeneration: () => generation,
        renewal: { shouldRenew: () => false, renew },
      });
      const decode = vi.fn(data => {
        // Review reproduction: queue invalidation behind the internal decoder and
        // perform checks, but before the outer race publishes its queued success.
        queueMicrotask(() =>
          queueMicrotask(() =>
            queueMicrotask(() => {
              invalidated = true;
              if (kind === 'caller-abort') controller.abort();
              else if (kind === 'dispose') client.dispose();
              else generation++;
            }),
          ),
        );
        return data;
      });
      const outcome = await client.execute({ ...spec, activity: 'background', signal: controller.signal, decode });
      expect(invalidated).toBe(true);
      expect(outcome).toEqual({ ok: false, error: { kind: 'aborted' } });
      expect(injected).toHaveBeenCalledTimes(1);
      expect(decode).toHaveBeenCalledTimes(1);
      expect(credentialsProvider).toHaveBeenCalledTimes(1);
      expect(activityReporter).not.toHaveBeenCalled();
      expect(renew).not.toHaveBeenCalled();
      client.dispose();
    },
  );
  it('dispose settles all fetch waiters and removes caller abort listeners when fetch never settles', async () => {
    const injected = vi.fn(
      (_input: Parameters<typeof fetch>[0], _init?: RequestInit) => new Promise<Response>(() => {}),
    );
    const { client } = fakeClient({ fetch: injected });
    const a = new AbortController(),
      b = new AbortController();
    const addA = vi.spyOn(a.signal, 'addEventListener'),
      removeA = vi.spyOn(a.signal, 'removeEventListener');
    const addB = vi.spyOn(b.signal, 'addEventListener'),
      removeB = vi.spyOn(b.signal, 'removeEventListener');
    const first = client.execute({ ...spec, signal: a.signal }),
      second = client.execute({ ...spec, signal: b.signal });
    await vi.waitFor(() => expect(injected).toHaveBeenCalledTimes(2));
    client.dispose();
    expect(await Promise.all([first, second])).toEqual([
      { ok: false, error: { kind: 'aborted' } },
      { ok: false, error: { kind: 'aborted' } },
    ]);
    expect(removeA).toHaveBeenCalledWith('abort', addA.mock.calls[0][1]);
    expect(removeB).toHaveBeenCalledWith('abort', addB.mock.calls[0][1]);
    for (const call of injected.mock.calls) expect(call[1]?.signal?.aborted).toBe(true);
  });
  it('disabled full and narrow entries ignore every transport dependency and decode, even after cancellation', async () => {
    const dependencies = {
      mode: 'disabled' as const,
      fetch: vi.fn(),
      credentialsProvider: vi.fn(),
      activityReporter: vi.fn(),
      errorNormalizer: vi.fn(),
      renewal: { shouldRenew: vi.fn(), renew: vi.fn() },
    };
    const controller = new AbortController();
    controller.abort();
    const decode = vi.fn();
    for (const client of [createRequestClient(dependencies), createDisabledRequestClient(dependencies)]) {
      expect(await client.execute({ ...spec, signal: controller.signal, decode })).toEqual({
        ok: false,
        error: { kind: 'not-enabled' },
      });
      client.dispose();
      expect(await client.execute(spec)).toEqual({ ok: false, error: { kind: 'not-enabled' } });
    }
    for (const callback of [
      dependencies.fetch,
      dependencies.credentialsProvider,
      dependencies.activityReporter,
      dependencies.errorNormalizer,
      dependencies.renewal.shouldRenew,
      dependencies.renewal.renew,
      decode,
    ])
      expect(callback).not.toHaveBeenCalled();
  });
  it('uses the injected URL, credentials and decoder and reports foreground activity once', async () => {
    const { client, fetch, credentialsProvider, activityReporter } = fakeClient();
    expect(await client.execute({ ...spec, decode: data => (data as { value: number }).value })).toEqual({
      ok: true,
      data: 7,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://controlled.invalid/api/items');
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      headers: expect.any(Headers),
      signal: expect.any(AbortSignal),
    });
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('X-Controlled-Credential')).toBe('fake-only');
    expect(credentialsProvider).toHaveBeenCalledTimes(1);
    expect(activityReporter).toHaveBeenCalledTimes(1);
    expect(await client.execute({ ...spec, activity: 'background' })).toEqual({ ok: true, data: { value: 7 } });
    expect(activityReporter).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 503])('normalizes ordinary HTTP %i without retry or renewal', async status => {
    const renew = vi.fn();
    const injected = vi.fn(async () =>
      Response.json(
        { code: 'DENIED', data: { reason: 'controlled' }, message: 'Denied' },
        { status, headers: { 'X-Request-Id': 'req-1', 'X-Trace-Id': 'trace-1' } },
      ),
    );
    const { client, errorNormalizer } = fakeClient({
      fetch: injected,
      renewal: { shouldRenew: isAccessExpired, renew },
    });
    expect(await client.execute(spec)).toEqual({
      ok: false,
      error: {
        kind: 'http',
        status,
        code: 'DENIED',
        message: 'Denied',
        requestId: 'req-1',
        traceId: 'trace-1',
        details: { reason: 'controlled' },
      },
    });
    expect(errorNormalizer).toHaveBeenCalledTimes(1);
    expect(injected).toHaveBeenCalledTimes(1);
    expect(renew).not.toHaveBeenCalled();
  });
  it.each([null, { value: 7 }, { data: 7, error: { code: 'INVALID' } }, { data: 7, request_id: 9 }])(
    'rejects malformed wire envelopes %j',
    async payload => {
      const { client } = fakeClient({ fetch: vi.fn(async () => Response.json(payload)) });
      expect(await client.execute(spec)).toMatchObject({ ok: false, error: { kind: 'protocol' } });
    },
  );
  it('classifies malformed JSON, failed decode, and rejected fetch without retry', async () => {
    const decode = vi.fn(() => {
      throw Error('decoder rejected');
    });
    for (const response of [new Response('not-json'), Response.json({ code: 0, data: 7, message: 'ok' })]) {
      const injected = vi.fn(async () => response);
      const { client } = fakeClient({ fetch: injected });
      expect(await client.execute({ ...spec, decode })).toMatchObject({ ok: false, error: { kind: 'protocol' } });
      expect(injected).toHaveBeenCalledTimes(1);
    }
    const injected = vi.fn(async () => {
      throw Error('offline');
    });
    expect(await fakeClient({ fetch: injected }).client.execute(spec)).toMatchObject({
      ok: false,
      error: { kind: 'transport' },
    });
    expect(injected).toHaveBeenCalledTimes(1);
  });
  it('settles promptly on abort when an injected fetch ignores its signal and suppresses late decoding', async () => {
    const response = deferred<Response>();
    const decode = vi.fn(data => data);
    const { client } = fakeClient({ fetch: vi.fn(() => response.promise) });
    const abort = new AbortController();
    const pending = client.execute({ ...spec, signal: abort.signal, decode });
    await vi.waitFor(() => expect(pending).toBeInstanceOf(Promise));
    abort.abort();
    expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
    response.resolve(Response.json({ code: 0, data: 7, message: 'ok' }));
    await Promise.resolve();
    expect(decode).not.toHaveBeenCalled();
  });
  it('does no work for pre-aborted requests and disposes in-flight work idempotently', async () => {
    const credentials = deferred<{ credentials: 'omit' }>();
    const provider = vi.fn(() => credentials.promise);
    const { client, fetch, activityReporter } = fakeClient({ credentialsProvider: provider });
    const abort = new AbortController();
    abort.abort();
    expect(await client.execute({ ...spec, signal: abort.signal })).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(provider).not.toHaveBeenCalled();
    expect(activityReporter).not.toHaveBeenCalled();
    const pending = client.execute(spec);
    client.dispose();
    client.dispose();
    expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
    credentials.resolve({ credentials: 'omit' });
    expect(await client.execute(spec)).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('suppresses old-generation responses and later requests retain their own generation', async () => {
    let generation = 1;
    const response = deferred<Response>();
    const decode = vi.fn(data => data);
    const injected = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => response.promise)
      .mockResolvedValue(Response.json({ code: 0, data: 8, message: 'ok' }));
    const { client } = fakeClient({ fetch: injected, getGeneration: () => generation });
    const old = client.execute({ ...spec, decode });
    await vi.waitFor(() => expect(injected).toHaveBeenCalledTimes(1));
    generation++;
    expect(await client.execute(spec)).toEqual({ ok: true, data: 8 });
    expect(await old).toEqual({ ok: false, error: { kind: 'aborted' } });
    response.resolve(Response.json({ code: 0, data: 7, message: 'ok' }));
    await Promise.resolve();
    expect(decode).not.toHaveBeenCalled();
  });
});
