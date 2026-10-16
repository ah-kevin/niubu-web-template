import { act } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { RequestOutcome, UploadProgress, UploadSource } from '@niubu/request';
import { createTransferApi } from '../../apps/playground/src/transfers/api';
import { mountPlayground } from './playground-fixture';

function source(bytes: Uint8Array, name = '真实文件.bin', contentType = 'application/octet-stream'): UploadSource {
  return { name, contentType, size: bytes.length, read: async (start, end) => bytes.slice(start, end) };
}

async function inAct<T>(run: () => Promise<T>): Promise<T> {
  let value!: T;
  await act(async () => { value = await run(); });
  return value;
}

function success<T>(outcome: RequestOutcome<T>): T {
  expect(outcome, `Expected actual API success: ${JSON.stringify(outcome)}`).toMatchObject({ ok: true });
  if (!outcome.ok) throw new Error(`Expected success: ${JSON.stringify(outcome.error)}`);
  return outcome.data;
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function reached<T>(entered: Promise<void>, pending: Promise<RequestOutcome<T>>) {
  await inAct(() => Promise.race([
    entered,
    pending.then(outcome => { throw new Error(`Operation ended before expected boundary: ${JSON.stringify(outcome)}`); }),
  ]));
}

async function drain() {
  await act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); });
}

type Fixture = Awaited<ReturnType<typeof mountPlayground>>;
const transfers = (f: Fixture) => f.calls.filter(call => call.url.pathname.startsWith('/api/transfers'));
const refreshes = (f: Fixture) => f.calls.filter(call => call.url.pathname === '/api/auth/refresh');
const users = (f: Fixture) => f.calls.filter(call => call.url.pathname === '/api/user');

function assertWire(f: Fixture, scopeId = 'north') {
  for (const call of transfers(f)) {
    expect([...call.url.searchParams]).toEqual([['scopeKind', 'workspace'], ['scopeId', scopeId]]);
    if (call.method === 'POST') {
      expect(call.body).toEqual(call.url.pathname.endsWith('/complete') ? {} : expect.objectContaining({ name: expect.any(String), size: expect.any(Number), contentType: expect.any(String) }));
    }
    if (call.method === 'PUT') expect(Object.keys(call.body as object).sort()).toEqual(['base64', 'offset']);
    if (call.method === 'GET' || call.method === 'DELETE') expect(call.body).toBeUndefined();
  }
}

it('round-trips 32769 bytes through the actual Root facade, two part ACKs, completion and filename', async () => {
  const f = await mountPlayground();
  try {
    const bytes = Uint8Array.from({ length: 32_769 }, (_, i) => i % 251);
    const context = f.runtime.api.getContext()!;
    const uploaded = success(await inAct(() => f.runtime.api.transfers.upload(context, source(bytes), { signal: new AbortController().signal })));
    const parts = f.calls.filter(call => call.method === 'PUT' && call.url.pathname.includes('/parts/'));
    expect(parts.map(call => [call.url.pathname.split('/').at(-1), call.status])).toEqual([['0', 200], ['1', 200]]);
    expect(uploaded).toMatchObject({ size: bytes.length, name: '真实文件.bin' });
    const downloaded = success(await inAct(() => f.runtime.api.transfers.download(context, uploaded.id)));
    expect(downloaded.filename).toBe('真实文件.bin');
    expect(downloaded.contentType).toBe('application/octet-stream');
    expect(new Uint8Array(await downloaded.blob.arrayBuffer())).toEqual(bytes);
    assertWire(f);
  } finally { await f.dispose(); }
});

it('preserves JSON, wire-shaped JSON, +json, empty MIME and zero-byte source bytes with octet-stream download', async () => {
  const cases = [
    { name: 'plain.json', mime: 'application/json', text: '{"hello":"世界"}' },
    { name: 'envelope.json', mime: 'application/json', text: '{"code":0,"data":{"ok":true},"message":"OK"}' },
    { name: 'structured.json', mime: 'application/problem+json', text: '{"status":403,"detail":"file contents"}' },
    { name: 'unknown.dat', mime: '', text: '\u0000\u0001raw\u00ff' },
    { name: 'empty.json', mime: 'application/json', text: '' },
  ];
  for (const item of cases) {
    const f = await mountPlayground();
    try {
      // Construct the promised Uint8Array in the test realm; TextEncoder is Node-owned in jsdom.
      const bytes = Uint8Array.from(new TextEncoder().encode(item.text));
      const context = f.runtime.api.getContext()!;
      const upload = await inAct(() => f.runtime.api.transfers.upload(context, source(bytes, item.name, item.mime), { signal: new AbortController().signal }));
      expect(upload, `${item.name}: ${JSON.stringify(upload)}`).toMatchObject({ ok: true });
      const uploaded = success(upload);
      expect(uploaded).toMatchObject({ name: item.name, size: bytes.length, contentType: item.mime || 'application/octet-stream' });
      const downloaded = success(await inAct(() => f.runtime.api.transfers.download(context, uploaded.id)));
      expect(downloaded.filename).toBe(item.name);
      expect(downloaded.contentType).toBe('application/octet-stream');
      expect(new Uint8Array(await downloaded.blob.arrayBuffer())).toEqual(bytes);
      expect(transfers(f).filter(call => call.method === 'PUT')).toHaveLength(bytes.length ? 1 : 0);
      assertWire(f);
    } finally { await f.dispose(); }
  }
});

it('reports only returned ACK bytes and remains completing after the final ACK until complete returns', async () => {
  const first = deferred(), second = deferred(), complete = deferred();
  const releaseFirst = deferred(), releaseSecond = deferred(), releaseComplete = deferred();
  const progress: UploadProgress[] = [];
  const reads: Array<[number, number]> = [];
  const f = await mountPlayground({ beforeResponse: async (request, response) => {
    if (response.status !== 200) return;
    if (request.method === 'PUT' && request.url.pathname.endsWith('/parts/0')) { first.resolve(); await releaseFirst.promise; }
    if (request.method === 'PUT' && request.url.pathname.endsWith('/parts/1')) { second.resolve(); await releaseSecond.promise; }
    if (request.url.pathname.endsWith('/complete')) { complete.resolve(); await releaseComplete.promise; }
  } });
  let pending: Promise<RequestOutcome<unknown>> | undefined;
  try {
    const bytes = new Uint8Array(32_769), input = source(bytes);
    input.read = async (start, end) => { reads.push([start, end]); return bytes.slice(start, end); };
    const context = f.runtime.api.getContext()!;
    let result: RequestOutcome<unknown> | undefined;
    pending = f.runtime.api.transfers.upload(context, input, { signal: new AbortController().signal, onProgress: p => progress.push(p) });
    void pending.then(value => { result = value; });
    await reached(first.promise, pending);
    expect(reads).toEqual([[0, 32_768]]);
    expect(progress).toEqual([{ acknowledgedBytes: 0, totalBytes: 32_769, phase: 'uploading' }]);
    expect(result).toBeUndefined();
    releaseFirst.resolve();
    await reached(second.promise, pending);
    expect(reads).toEqual([[0, 32_768], [32_768, 32_769]]);
    expect(progress.at(-1)).toEqual({ acknowledgedBytes: 32_768, totalBytes: 32_769, phase: 'uploading' });
    expect(result).toBeUndefined();
    releaseSecond.resolve();
    await reached(complete.promise, pending);
    expect(progress.at(-1)).toEqual({ acknowledgedBytes: 32_769, totalBytes: 32_769, phase: 'completing' });
    expect(progress.some(p => p.phase === 'complete')).toBe(false);
    expect(result).toBeUndefined();
    releaseComplete.resolve();
    success(await inAct(() => pending!));
    expect(progress).toEqual([
      { acknowledgedBytes: 0, totalBytes: 32_769, phase: 'uploading' },
      { acknowledgedBytes: 32_768, totalBytes: 32_769, phase: 'uploading' },
      { acknowledgedBytes: 32_769, totalBytes: 32_769, phase: 'uploading' },
      { acknowledgedBytes: 32_769, totalBytes: 32_769, phase: 'completing' },
      { acknowledgedBytes: 32_769, totalBytes: 32_769, phase: 'complete' },
    ]);
  } finally {
    releaseFirst.resolve(); releaseSecond.resolve(); releaseComplete.resolve();
    if (pending) await inAct(() => pending!);
    await f.dispose();
  }
});

it('settles user cancellation during read or completing and rejects late bytes or an already dispatched completion', async () => {
  for (const phase of ['read', 'completing'] as const) {
    const entered = deferred(), read = deferred<Uint8Array>(), releaseComplete = deferred();
    const progress: UploadProgress[] = [], user = new AbortController();
    const f = await mountPlayground({ beforeResponse: async request => {
      if (phase === 'completing' && request.url.pathname.endsWith('/complete')) { entered.resolve(); await releaseComplete.promise; }
    } });
    let pending: Promise<RequestOutcome<unknown>> | undefined;
    try {
      const input = source(new Uint8Array([7]));
      if (phase === 'read') input.read = async () => { entered.resolve(); return read.promise; };
      pending = f.runtime.api.transfers.upload(f.runtime.api.getContext()!, input, { signal: user.signal, onProgress: p => progress.push(p) });
      await reached(entered.promise, pending);
      if (phase === 'completing') expect(progress.at(-1)).toEqual({ acknowledgedBytes: 1, totalBytes: 1, phase: 'completing' });
      await act(async () => user.abort());
      expect(await inAct(() => pending!)).toEqual({ ok: false, error: { kind: 'aborted' } });
      const before = [...progress];
      read.resolve(new Uint8Array([7])); releaseComplete.resolve();
      await drain();
      expect(progress).toEqual(before);
      expect(progress.some(p => p.phase === 'complete')).toBe(false);
      expect(transfers(f).map(call => call.method)).toEqual(phase === 'read' ? ['POST', 'DELETE'] : ['POST', 'PUT', 'POST', 'DELETE']);
      const cleanup = transfers(f).at(-1)!;
      expect(cleanup.status).toBe(200);
      expect(cleanup.signal?.aborted).toBe(false);
      expect(cleanup.signal).not.toBe(user.signal);
      assertWire(f);
    } finally { user.abort(); read.resolve(new Uint8Array([7])); releaseComplete.resolve(); if (pending) await inAct(() => pending!); await f.dispose(); }
  }
});

it('actively settles session revocation during an abort-ignoring read and never advances or cleans with a retired lease', async () => {
  const entered = deferred(), read = deferred<Uint8Array>(), progress: UploadProgress[] = [];
  const f = await mountPlayground();
  let pending: Promise<RequestOutcome<unknown>> | undefined;
  try {
    const input = source(new Uint8Array([8]));
    input.read = async () => { entered.resolve(); return read.promise; };
    const original = f.runtime.auth.requestContext().signal;
    let result: RequestOutcome<unknown> | undefined;
    pending = f.runtime.api.transfers.upload(f.runtime.api.getContext()!, input, { signal: new AbortController().signal, onProgress: p => progress.push(p) });
    void pending.then(value => { result = value; });
    await reached(entered.promise, pending);
    await act(async () => f.runtime.auth.markLoginExpired());
    await drain();
    const atRevocation = result, before = [...progress];
    expect(original.aborted).toBe(true);
    read.resolve(new Uint8Array([8]));
    await inAct(() => pending!);
    expect.soft(atRevocation).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect.soft(result).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect.soft(progress).toEqual(before);
    expect.soft(transfers(f).map(call => call.method)).toEqual(['POST']);
  } finally { read.resolve(new Uint8Array([8])); if (pending) await inAct(() => pending!); await f.dispose(); }
});

it('revokes the original scope lease during read and cannot borrow a fresh south session to send cancel or late parts', async () => {
  const entered = deferred(), read = deferred<Uint8Array>(), user = new AbortController(), progress: UploadProgress[] = [];
  const f = await mountPlayground();
  let pending: Promise<RequestOutcome<unknown>> | undefined;
  try {
    const oldContext = f.runtime.api.getContext()!, original = f.runtime.auth.requestContext().signal;
    const input = source(new Uint8Array([9]));
    input.read = async () => { entered.resolve(); return read.promise; };
    let result: RequestOutcome<unknown> | undefined;
    pending = f.runtime.api.transfers.upload(oldContext, input, { signal: user.signal, onProgress: p => progress.push(p) });
    void pending.then(value => { result = value; });
    await reached(entered.promise, pending);
    await act(async () => { await f.runtime.router.navigate('/home?scopeKind=workspace&scopeId=south'); });
    await drain();
    const atRevocation = result, before = [...progress];
    expect(original.aborted).toBe(true);
    expect(f.runtime.api.getContext()?.scope?.id).toBe('south');
    expect(f.runtime.auth.requestContext().signal.aborted).toBe(false);
    await act(async () => user.abort());
    read.resolve(new Uint8Array([9]));
    expect(await inAct(() => pending!)).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect.soft(atRevocation).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect.soft(progress).toEqual(before);
    expect.soft(transfers(f).map(call => call.method)).toEqual(['POST']);
    expect(transfers(f)[0].url.searchParams.get('scopeId')).toBe('north');
  } finally { user.abort(); read.resolve(new Uint8Array([9])); if (pending) await inAct(() => pending!); await f.dispose(); }
});

it('rejects an actual dispatched ACK delivered after session revocation without late progress, complete or cleanup', async () => {
  const entered = deferred(), release = deferred(), progress: UploadProgress[] = [];
  const f = await mountPlayground({ beforeResponse: async request => {
    if (request.method === 'PUT') { entered.resolve(); await release.promise; }
  } });
  let pending: Promise<RequestOutcome<unknown>> | undefined;
  try {
    pending = f.runtime.api.transfers.upload(f.runtime.api.getContext()!, source(new Uint8Array([10])), { signal: new AbortController().signal, onProgress: p => progress.push(p) });
    await reached(entered.promise, pending);
    expect(transfers(f).at(-1)?.status).toBe(200);
    await act(async () => f.runtime.auth.markLoginExpired());
    expect(await inAct(() => pending!)).toEqual({ ok: false, error: { kind: 'aborted' } });
    const before = [...progress];
    release.resolve();
    await drain();
    expect(progress).toEqual(before);
    expect(progress.at(-1)?.acknowledgedBytes).toBe(0);
    expect(transfers(f).map(call => call.method)).toEqual(['POST', 'PUT']);
  } finally { release.resolve(); if (pending) await inAct(() => pending!); await f.dispose(); }
});

it('enforces north viewer and south transfer denial at the actual API with 403 and no renewal', async () => {
  for (const options of [{ username: 'second@playground.invalid' }, { entry: '/home?scopeKind=workspace&scopeId=south' }]) {
    const f = await mountPlayground(options);
    try {
      const context = f.runtime.api.getContext()!, baseline = refreshes(f).length;
      const upload = await inAct(() => f.runtime.api.transfers.upload(context, source(new Uint8Array([11])), { signal: new AbortController().signal }));
      const download = await inAct(() => f.runtime.api.transfers.download(context, 'not-owned'));
      expect(upload).toMatchObject({ ok: false, error: { kind: 'http', status: 403 } });
      expect(download).toMatchObject({ ok: false, error: { kind: 'http', status: 403 } });
      expect(transfers(f).map(call => call.status)).toEqual([403, 403]);
      expect(refreshes(f)).toHaveLength(baseline);
      assertWire(f, context.scope!.id);
    } finally { await f.dispose(); }
  }
});

it('never replays expired begin, recovers via the single GET coordinator and requires a second explicit upload', async () => {
  let now = 299_999;
  const f = await mountPlayground({ now: () => now });
  try {
    // Login occurred at 299999, so expire its access lease while no transfer exists.
    now += 300_001;
    const context = f.runtime.api.getContext()!, baseline = users(f).length;
    const first = await inAct(() => f.runtime.api.transfers.upload(context, source(new Uint8Array([12])), { signal: new AbortController().signal }));
    expect.soft(first).toMatchObject({ ok: false, error: { code: 'TRANSFER_RECONFIRM' } });
    expect(transfers(f).map(call => [call.method, call.status])).toEqual([['POST', 401]]);
    expect.soft(refreshes(f)).toHaveLength(1);
    expect.soft(users(f).slice(baseline).map(call => [call.method, call.status])).toEqual([['GET', 401], ['GET', 200]]);
    success(await inAct(() => f.runtime.api.transfers.upload(f.runtime.api.getContext()!, source(new Uint8Array([12])), { signal: new AbortController().signal })));
    expect(transfers(f).filter(call => call.url.pathname === '/api/transfers').map(call => call.status)).toEqual([401, 200]);
    expect(refreshes(f)).toHaveLength(1);
    assertWire(f);
  } finally { await f.dispose(); }
});

it('never replays expired complete, recovers once, cleans the original id and succeeds only after explicit reupload', async () => {
  let now = 0, expireAfterPart = true;
  const f = await mountPlayground({ now: () => now, beforeResponse: request => {
    if (expireAfterPart && request.method === 'PUT') { expireAfterPart = false; now = 300_001; }
  } });
  try {
    // Start near expiry so the transfer TTL survives access expiry during the final ACK.
    now = 299_999;
    const baseline = users(f).length, progress: UploadProgress[] = [];
    const first = await inAct(() => f.runtime.api.transfers.upload(f.runtime.api.getContext()!, source(new Uint8Array([13])), { signal: new AbortController().signal, onProgress: p => progress.push(p) }));
    expect.soft(first).toMatchObject({ ok: false, error: { code: 'TRANSFER_RECONFIRM' } });
    await drain();
    const completed = transfers(f).filter(call => call.url.pathname.endsWith('/complete'));
    expect(completed.map(call => call.status)).toEqual([401]);
    expect.soft(refreshes(f)).toHaveLength(1);
    expect.soft(users(f).slice(baseline).map(call => [call.method, call.status])).toEqual([['GET', 401], ['GET', 200]]);
    expect(progress.at(-1)).toEqual({ acknowledgedBytes: 1, totalBytes: 1, phase: 'completing' });
    const cleanup = transfers(f).filter(call => call.method === 'DELETE');
    // The failed pre-renewal best effort and the explicit post-renewal cleanup are separate sends.
    expect(cleanup.map(call => call.status)).toEqual([401, 200]);
    expect(cleanup[1].signal).not.toBe(cleanup[0].signal);
    for (const call of cleanup) expect(`${call.url.pathname}/complete`).toBe(completed[0].url.pathname);
    const second = success(await inAct(() => f.runtime.api.transfers.upload(f.runtime.api.getContext()!, source(new Uint8Array([13])), { signal: new AbortController().signal })));
    expect(`/api/transfers/${second.id}/complete`).not.toBe(completed[0].url.pathname);
    expect(transfers(f).filter(call => call.url.pathname.endsWith('/complete')).map(call => call.status)).toEqual([401, 200]);
    expect(refreshes(f)).toHaveLength(1);
    assertWire(f);
  } finally { await f.dispose(); }
});

it('shares one real renewal for concurrent expired download GETs and replays each at most once', async () => {
  let now = 0;
  const entered = deferred(), release = deferred();
  let expiredGets = 0;
  const f = await mountPlayground({ now: () => now, beforeResponse: async (request, response) => {
    if (request.url.pathname.endsWith('/download') && response.status === 401) {
      if (++expiredGets === 2) entered.resolve();
      await release.promise;
    }
  } });
  let pending: Promise<RequestOutcome<unknown>> | undefined;
  try {
    now = 299_999;
    const context = f.runtime.api.getContext()!, bytes = new Uint8Array([0, 255, 14]);
    const file = success(await inAct(() => f.runtime.api.transfers.upload(context, source(bytes), { signal: new AbortController().signal })));
    now = 300_001;
    const a = f.runtime.api.transfers.download(context, file.id), b = f.runtime.api.transfers.download(context, file.id);
    pending = a;
    await reached(entered.promise, a);
    release.resolve();
    const results = await inAct(() => Promise.all([a, b]));
    for (const result of results) expect(new Uint8Array(await success(result).blob.arrayBuffer())).toEqual(bytes);
    expect(refreshes(f)).toHaveLength(1);
    expect(transfers(f).filter(call => call.method === 'GET').map(call => call.status)).toEqual([401, 401, 200, 200]);
    assertWire(f);
  } finally { release.resolve(); if (pending) await inAct(() => pending!); await f.dispose(); }
});

it('fails closed without the genuine session getter even when using the mounted Root request client', async () => {
  const f = await mountPlayground();
  try {
    const api = createTransferApi(f.runtime.request, f.runtime.api.getContext);
    const context = f.runtime.api.getContext()!;
    const upload = await inAct(() => api.upload(context, source(new Uint8Array([15])), { signal: new AbortController().signal }));
    const download = await inAct(() => api.download(context, 'not-owned'));
    expect.soft(upload).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect.soft(download).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect.soft(transfers(f)).toHaveLength(0);
  } finally { await f.dispose(); }
});
