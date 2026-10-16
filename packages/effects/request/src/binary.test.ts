import { describe, expect, it, vi } from 'vitest';
import { deferred, fakeClient, spec } from './test-helpers';
import { isAccessExpired } from './protocol';
import { downloadBlob } from './download';
import type { RequestClient } from './types';

describe('binary responses through the existing client', () => {
  it('decodes raw bytes with lowercase HTTP metadata and the same credentials/activity', async () => {
    const response = new Response(new Uint8Array([0, 255, 7]), {
      headers: { 'Content-Type': 'application/octet-stream', 'X-Request-Id': 'request', 'X-Trace-Id': 'trace' },
    });
    const { client, credentialsProvider, activityReporter } = fakeClient({ fetch: vi.fn(async () => response) });
    const decode = vi.fn(data => data);
    const outcome = await client.execute({ ...spec, responseType: 'blob', decode });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect([...new Uint8Array(await (outcome.data as Blob).arrayBuffer())]).toEqual([0, 255, 7]);
    expect(decode).toHaveBeenCalledWith(expect.any(Blob), {
      status: 200,
      headers: { 'content-type': 'application/octet-stream', 'x-request-id': 'request', 'x-trace-id': 'trace' },
      requestId: 'request', traceId: 'trace',
    });
    expect(credentialsProvider).toHaveBeenCalledOnce();
    expect(activityReporter).toHaveBeenCalledOnce();
    client.dispose();
  });

  it.each(['application/json', 'Application/Problem+JSON; charset=utf-8'])(
    'rejects JSON success envelopes as downloads for %s', async contentType => {
      const decode = vi.fn(data => data);
      const { client } = fakeClient({ fetch: vi.fn(async () => new Response(
        JSON.stringify({ code: 0, data: 'not a file', message: 'ok' }), { headers: { 'Content-Type': contentType } },
      )) });
      expect(await client.execute({ ...spec, responseType: 'blob', decode })).toMatchObject({ ok: false, error: { kind: 'protocol', status: 200 } });
      expect(decode).not.toHaveBeenCalled();
      client.dispose();
    },
  );

  it.each([401, 403])('keeps ordinary JSON HTTP %i on the wire path without renewal', async status => {
    const renew = vi.fn();
    const fetch = vi.fn(async () => Response.json({ code: 'DENIED', data: null, message: 'Denied' }, { status }));
    const { client } = fakeClient({ fetch, renewal: { shouldRenew: isAccessExpired, renew } });
    expect(await client.execute({ ...spec, responseType: 'blob' })).toMatchObject({ ok: false, error: { kind: 'http', status, code: 'DENIED' } });
    expect(fetch).toHaveBeenCalledOnce();
    expect(renew).not.toHaveBeenCalled();
    client.dispose();
  });

  it.each(['GET', 'POST'])('renews at most once for replayable %s downloads only', async method => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ code: 'ACCESS_EXPIRED', data: null, message: 'Expired' }, { status: 401 }))
      .mockResolvedValueOnce(new Response('file', { headers: { 'Content-Type': 'text/csv' } }));
    const renew = vi.fn(async () => ({ ok: true as const, data: undefined }));
    const { client, activityReporter } = fakeClient({ fetch, renewal: { shouldRenew: isAccessExpired, renew } });
    const outcome = await client.execute({ ...spec, method, responseType: 'blob' });
    expect(outcome.ok).toBe(method === 'GET');
    expect(fetch).toHaveBeenCalledTimes(method === 'GET' ? 2 : 1);
    expect(renew).toHaveBeenCalledTimes(method === 'GET' ? 1 : 0);
    expect(activityReporter).toHaveBeenCalledOnce();
    client.dispose();
  });

  it('does not renew twice if the replay expires again', async () => {
    const fetch = vi.fn(async () => Response.json({ code: 'ACCESS_EXPIRED', data: null, message: 'Expired' }, { status: 401 }));
    const renew = vi.fn(async () => ({ ok: true as const, data: undefined }));
    const { client } = fakeClient({ fetch, renewal: { shouldRenew: isAccessExpired, renew } });
    expect(await client.execute({ ...spec, responseType: 'blob' })).toMatchObject({ ok: false, error: { code: 'ACCESS_EXPIRED' } });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(renew).toHaveBeenCalledOnce();
    client.dispose();
  });

  it.each(['missing-mime', 'malformed-json', 'non-json-error', 'unreadable-body', 'decoder'])(
    'reports %s as protocol failure with tracing', async failure => {
      const headers: Record<string, string> = { 'X-Trace-Id': 'trace' };
      if (failure !== 'missing-mime') headers['Content-Type'] = failure === 'malformed-json' ? 'application/json' : 'application/octet-stream';
      const response = new Response(new Uint8Array([123]), { status: failure === 'non-json-error' ? 500 : 200, headers });
      if (failure === 'unreadable-body') await response.arrayBuffer();
      const { client } = fakeClient({ fetch: vi.fn(async () => response) });
      expect(await client.execute({ ...spec, responseType: 'blob', decode: () => { throw Error('rejected'); } })).toMatchObject({ ok: false, error: { kind: 'protocol', traceId: 'trace' } });
      client.dispose();
    },
  );

  it.each(['abort', 'dispose', 'generation'] as const)('suppresses late blob/decode after %s', async invalidation => {
    const body = deferred<Blob>();
    const response = new Response('file', { headers: { 'Content-Type': 'application/octet-stream' } });
    const blob = vi.spyOn(response, 'blob').mockReturnValue(body.promise);
    let generation = 1;
    const controller = new AbortController();
    const decode = vi.fn(data => data);
    const { client } = fakeClient({ fetch: vi.fn(async () => response), getGeneration: () => generation });
    const pending = client.execute({ ...spec, signal: controller.signal, responseType: 'blob', decode });
    await vi.waitFor(() => expect(blob).toHaveBeenCalledOnce());
    if (invalidation === 'abort') controller.abort();
    else if (invalidation === 'dispose') client.dispose();
    else generation++;
    if (invalidation !== 'generation') expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
    body.resolve(new Blob(['late']));
    expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(decode).not.toHaveBeenCalled();
    client.dispose();
  });

  it('keeps JSON defaults and supplies metadata to old and new decoders', async () => {
    const { client } = fakeClient();
    const decode = vi.fn(data => data);
    expect(await client.execute({ ...spec, decode })).toEqual({ ok: true, data: { value: 7 } });
    expect(decode).toHaveBeenCalledWith({ value: 7 }, { status: 200, headers: { 'content-type': 'application/json' } });
    client.dispose();
  });

  it.each(['application/octet-stream', 'text/csv', 'image/png'])('downloads raw %s bytes and safe server filename', async contentType => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(new Uint8Array([0, 255]), {
      headers: { 'Content-Type': contentType, 'Content-Disposition': 'attachment; filename="ascii.csv"; filename*=UTF-8\'\'%E4%B8%AD%E6%96%87.csv' },
    }));
    const { client } = fakeClient({ fetch });
    const outcome = await downloadBlob(client, { path: 'download', method: 'GET', activity: 'background' }, '../fallback');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.filename).toBe('中文.csv');
      expect(outcome.data.contentType).toBe(contentType);
      expect([...new Uint8Array(await outcome.data.blob.arrayBuffer())]).toEqual([0, 255]);
    }
    expect(fetch.mock.calls[0][0]).toBe('https://controlled.invalid/api/download');
    client.dispose();
  });

  it('downloads a zero-byte file with a sanitized fallback', async () => {
    const { client } = fakeClient({ fetch: vi.fn(async () => new Response(new Uint8Array(), { headers: { 'Content-Type': 'application/octet-stream' } })) });
    const outcome = await downloadBlob(client, { path: 'download', method: 'GET', activity: 'background' }, '../../fallback.txt');
    expect(outcome).toEqual({ ok: true, data: { blob: expect.any(Blob), filename: 'fallback.txt', contentType: 'application/octet-stream' } });
    if (outcome.ok) expect(outcome.data.blob.size).toBe(0);
    client.dispose();
  });

  it('requires optional response metadata when a client invokes the download decoder', async () => {
    const client: RequestClient = {
      mode: 'enabled', dispose() {},
      async execute(request) {
        try { return { ok: true, data: await request.decode(new Blob(['file'])) }; }
        catch (details) { return { ok: false, error: { kind: 'protocol', details } }; }
      },
    };
    expect(await downloadBlob(client, { path: 'download', method: 'GET', activity: 'background' })).toMatchObject({ ok: false, error: { kind: 'protocol', details: expect.any(Error) } });
  });

  it.each(['abort', 'dispose', 'generation'] as const)('suppresses late asynchronous decoder publication after %s', async invalidation => {
    const decoding = deferred<unknown>();
    let generation = 1;
    const controller = new AbortController();
    const decode = vi.fn(() => decoding.promise);
    const { client } = fakeClient({ fetch: vi.fn(async () => new Response('file', { headers: { 'Content-Type': 'application/octet-stream' } })), getGeneration: () => generation });
    const pending = client.execute({ ...spec, responseType: 'blob', signal: controller.signal, decode });
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
    if (invalidation === 'abort') controller.abort();
    else if (invalidation === 'dispose') client.dispose();
    else generation++;
    decoding.resolve('late');
    expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
    client.dispose();
  });

  it('keeps the protocol entry usable without DOM/UI/crypto globals', async () => {
    const globals = ['window', 'document', 'crypto'] as const;
    const saved = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    try {
      for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error('unexpected global access'); } });
      vi.resetModules();
      const protocol = await import('@niubu/request/protocol');
      expect(protocol.isAccessExpired({ kind: 'http', status: 401, code: protocol.ACCESS_EXPIRED_CODE })).toBe(true);
    } finally {
      globals.forEach((key, index) => { if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!); else Reflect.deleteProperty(globalThis, key); });
    }
  });

  it.each(['not-a-mime', 'application/', '/octet-stream', 'text /csv'])('rejects an ambiguous binary MIME: %s', async contentType => {
    const { client } = fakeClient({ fetch: vi.fn(async () => new Response('file', { headers: { 'Content-Type': contentType } })) });
    expect(await client.execute({ ...spec, responseType: 'blob' })).toMatchObject({ ok: false, error: { kind: 'protocol' } });
    client.dispose();
  });

  it('uses wire errors even when HTTP failure declares a binary MIME', async () => {
    const { client } = fakeClient({ fetch: vi.fn(async () => new Response(JSON.stringify({ code: 'DENIED', data: null, message: 'Denied' }), { status: 403, headers: { 'Content-Type': 'application/octet-stream' } })) });
    expect(await client.execute({ ...spec, responseType: 'blob' })).toMatchObject({ ok: false, error: { kind: 'http', status: 403, code: 'DENIED' } });
    client.dispose();
  });

  it('preserves octet-stream source JSON bytes, including content that resembles a wire envelope', async () => {
    const bytes = '{"code":0,"data":null,"message":"source file"}';
    const { client } = fakeClient({ fetch: vi.fn(async () => new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })) });
    const outcome = await downloadBlob(client, { path: 'source.json', method: 'GET', activity: 'background' }, 'source.json');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(await outcome.data.blob.text()).toBe(bytes);
    client.dispose();
  });

  it('keeps default JSON decoding when a successful response declares a non-JSON MIME', async () => {
    const { client } = fakeClient({ fetch: vi.fn(async () => new Response('{"code":0,"data":7,"message":"ok"}', { headers: { 'Content-Type': 'text/plain' } })) });
    expect(await client.execute(spec)).toEqual({ ok: true, data: 7 });
    client.dispose();
  });

  it('shares one existing renewal flight between concurrent binary requests', async () => {
    const renewing = deferred<import('./errors').RequestOutcome<void>>();
    let expired = true;
    const fetch = vi.fn(async () => expired
      ? Response.json({ code: 'ACCESS_EXPIRED', data: null, message: 'Expired' }, { status: 401 })
      : new Response('file', { headers: { 'Content-Type': 'text/csv' } }));
    const renew = vi.fn(() => renewing.promise);
    const { client } = fakeClient({ fetch, renewal: { shouldRenew: isAccessExpired, renew } });
    const first = client.execute({ ...spec, responseType: 'blob' });
    const second = client.execute({ ...spec, responseType: 'blob' });
    await vi.waitFor(() => expect(renew).toHaveBeenCalledOnce());
    expired = false;
    renewing.resolve({ ok: true, data: undefined });
    expect((await first).ok).toBe(true);
    expect((await second).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(renew).toHaveBeenCalledOnce();
    client.dispose();
  });
});
