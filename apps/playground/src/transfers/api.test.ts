// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createRequestClient, isAccessExpired, type RequestClient, type RequestError, type RequestOutcome, type RequestSpec, type UploadSource } from '@niubu/request';
import type { AuthContext } from '@niubu/types';
import { createTransferApi } from './api';

const context: AuthContext = { identityKey: 'owner', scope: { kind: 'workspace', id: 'north' }, generation: 7 };
const file = { id: 'upload-1', name: 'source.json', size: 0, contentType: 'application/json' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture() {
  const specs: RequestSpec<unknown>[] = [];
  let current: AuthContext | null = structuredClone(context);
  const session = new AbortController();
  const failure = vi.fn<(request: RequestSpec<unknown>) => RequestError | undefined>(() => undefined);
  const respond = vi.fn<(request: RequestSpec<unknown>) => unknown>(request => {
    if (request.path === '/api/user') return { id: 'owner', name: 'Owner', roles: [], workspaces: [{ kind: 'workspace', id: 'north' }] };
    if (request.method === 'DELETE') return null;
    if (request.path.endsWith('/complete')) return file;
    if (request.path.includes('/parts/')) return { index: 0, acknowledgedBytes: 1 };
    if (request.path.endsWith('/download')) return new Blob(['file']);
    return { uploadId: 'upload-1' };
  });
  const client: RequestClient = { mode: 'enabled', async execute<T>(request: RequestSpec<T>): Promise<RequestOutcome<T>> {
    specs.push(request as RequestSpec<unknown>);
    const error = failure(request as RequestSpec<unknown>);
    if (error) return { ok: false, error };
    try {
      const data = await respond(request as RequestSpec<unknown>);
      return { ok: true, data: await request.decode(data, { status: 200, headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="safe.json"' } }) };
    } catch (details) { return { ok: false, error: { kind: 'protocol', details } }; }
  }, dispose() {} };
  const execute = vi.spyOn(client, 'execute');
  const getContext = () => current;
  const getSessionSignal = () => session.signal;
  const source: UploadSource = { name: file.name, contentType: file.contentType, size: 0, read: vi.fn(async (start, end) => new Uint8Array(end - start)) };
  return { specs, execute, client, respond, failure, source, session, getContext, getSessionSignal, setCurrent: (value: AuthContext | null) => { current = value; } };
}

it('encodes the empty upload through the exact begin/complete routes and scoped query', async () => {
  const f = fixture();
  const api = createTransferApi(f.client, f.getContext, f.getSessionSignal);
  expect(await api.upload(context, f.source, { signal: new AbortController().signal })).toEqual({ ok: true, data: file });
  expect(f.specs.map(s => [s.method, s.path, s.body && JSON.parse(String(s.body))])).toEqual([
    ['POST', '/api/transfers', { name: 'source.json', contentType: 'application/json', size: 0 }],
    ['POST', '/api/transfers/upload-1/complete', {}],
  ]);
  for (const spec of f.specs) {
    expect(spec.query).toEqual({ scopeKind: 'workspace', scopeId: 'north' });
    expect(spec.allowReplay).toBe(false);
    expect(new Headers(spec.headers).get('content-type')).toBe('application/json');
  }
});

it.each(['upload', 'download'] as const)('requires a genuine session getter for %s', async method => {
  const f = fixture();
  const api = createTransferApi(f.client, f.getContext);
  const outcome = method === 'upload' ? await api.upload(context, f.source, { signal: new AbortController().signal }) : await api.download(context, 'upload-1');
  expect(outcome).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(f.execute).not.toHaveBeenCalled();
});

it.each([
  null,
  { ...context, generation: 8 },
  { ...context, identityKey: 'other' },
  { ...context, scope: { kind: 'workspace', id: 'south' } },
])('rejects a non-current or non-ready context before any request: %j', async current => {
  const f = fixture();
  f.setCurrent(current);
  const api = createTransferApi(f.client, f.getContext, f.getSessionSignal);
  expect(await api.upload(context, f.source, { signal: new AbortController().signal })).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(await api.download(context, 'upload-1')).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(f.execute).not.toHaveBeenCalled();
});

it('does not replace an already aborted session with a fabricated live signal', async () => {
  const f = fixture();
  f.session.abort();
  const api = createTransferApi(f.client, f.getContext, f.getSessionSignal);
  expect(await api.upload(context, f.source, { signal: new AbortController().signal })).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(await api.download(context, 'upload-1')).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(f.execute).not.toHaveBeenCalled();
});

it.each(['begin', 'read', 'chunk', 'complete', 'download'] as const)('settles on session cancellation even when %s ignores its signal', async stage => {
  const f = fixture();
  f.source.size = stage === 'read' || stage === 'chunk' ? 1 : 0;
  const waiting = deferred<unknown>();
  const started = vi.fn();
  const normal = f.respond.getMockImplementation()!;
  if (stage === 'read') vi.mocked(f.source.read).mockImplementationOnce(async () => { started(); return await waiting.promise as Uint8Array; });
  else f.respond.mockImplementation(request => {
    const matches = stage === 'begin' ? request.path === '/api/transfers' : stage === 'chunk' ? request.method === 'PUT' : request.path.endsWith(`/${stage}`);
    if (matches) { started(); return waiting.promise; }
    return normal(request);
  });
  const api = createTransferApi(f.client, f.getContext, f.getSessionSignal);
  const pending = stage === 'download' ? api.download(context, 'upload-1') : api.upload(context, f.source, { signal: new AbortController().signal });
  let result: RequestOutcome<unknown> | undefined;
  void pending.then(outcome => { result = outcome; });
  await vi.waitFor(() => expect(started).toHaveBeenCalled());
  f.session.abort();
  for (let i = 0; i < 25; i++) await Promise.resolve();
  const atAbort = result;
  waiting.resolve(stage === 'begin' ? { uploadId: 'upload-1' } : stage === 'read' ? new Uint8Array([0]) : stage === 'chunk' ? { index: 0, acknowledgedBytes: 1 } : stage === 'complete' ? file : new Blob(['late']));
  await pending;
  expect(atAbort).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(f.specs.filter(s => s.method === 'DELETE')).toHaveLength(0);
});

it('snapshots nested context and refuses a mutation during begin instead of sending to the new scope', async () => {
  const f = fixture();
  const mutable = { identityKey: context.identityKey, generation: context.generation, scope: { kind: 'workspace', id: 'north' } };
  f.setCurrent(mutable);
  f.respond.mockImplementationOnce(() => {
    mutable.scope!.id = 'south';
    return { uploadId: 'upload-1' };
  });
  expect(await createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(mutable, f.source, { signal: new AbortController().signal })).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(f.specs).toHaveLength(1);
  expect(f.specs[0].query).toEqual({ scopeKind: 'workspace', scopeId: 'north' });
});

it('only marks the proven idempotent part PUT replayable and checks returned file id', async () => {
  const f = fixture();
  f.source.size = 1;
  f.respond.mockImplementation(request => request.method === 'PUT' ? { index: 0, acknowledgedBytes: 1 } : request.path.endsWith('/complete') ? { ...file, id: 'other', size: 1 } : { uploadId: 'upload-1' });
  const outcome = await createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(context, f.source, { signal: new AbortController().signal });
  expect(outcome).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  const part = f.specs.find(s => s.method === 'PUT')!;
  expect(part.path).toBe('/api/transfers/upload-1/parts/0');
  expect(part.allowReplay).toBe(true);
  expect(JSON.parse(String(part.body))).toEqual({ offset: 0, base64: 'AA==' });
  const cleanup = f.specs.find(s => s.method === 'DELETE')!;
  expect(cleanup.path).toBe('/api/transfers/upload-1');
  expect(cleanup.body).toBeUndefined();
  expect(cleanup.allowReplay).toBe(false);
});

it.each([
  { uploadId: 'upload-1', extra: true },
  { uploadId: '../other' },
  { uploadId: '' },
])('strictly rejects invalid begin data %j', async payload => {
  const f = fixture();
  f.respond.mockReturnValue(payload);
  expect(await createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(context, f.source, { signal: new AbortController().signal })).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  expect(f.specs).toHaveLength(1);
});

it.each([
  { index: 0, acknowledgedBytes: 1, extra: true },
  { index: 1, acknowledgedBytes: 1 },
  { index: 0, acknowledgedBytes: 0 },
])('strictly rejects malformed or inaccurate ACK %j', async payload => {
  const f = fixture();
  f.source.size = 1;
  const normal = f.respond.getMockImplementation()!;
  f.respond.mockImplementation(request => request.method === 'PUT' ? payload : normal(request));
  expect(await createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(context, f.source, { signal: new AbortController().signal })).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  expect(f.specs.some(s => s.path.endsWith('/complete'))).toBe(false);
});

it.each([
  { ...file, extra: true },
  { ...file, id: 'other' },
  { ...file, size: -1 },
  { ...file, size: 1 },
  { ...file, name: 7 },
])('strictly rejects a mismatched or malformed completion %j', async payload => {
  const f = fixture();
  const normal = f.respond.getMockImplementation()!;
  f.respond.mockImplementation(request => request.path.endsWith('/complete') ? payload : normal(request));
  expect(await createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(context, f.source, { signal: new AbortController().signal })).toMatchObject({ ok: false, error: { kind: 'protocol' } });
});

it.each(['begin', 'complete'] as const)('recovers an expired %s via the same client GET and demands explicit reconfirmation without write replay', async phase => {
  const f = fixture();
  f.failure.mockImplementation(request => (phase === 'begin' ? request.path === '/api/transfers' : request.path.endsWith('/complete')) ? { kind: 'http', status: 401, code: 'ACCESS_EXPIRED' } : undefined);
  const api = createTransferApi(f.client, f.getContext, f.getSessionSignal);
  expect(await api.upload(context, f.source, { signal: new AbortController().signal })).toMatchObject({ ok: false, error: { code: 'TRANSFER_RECONFIRM' } });
  expect(f.specs.filter(s => s.path === '/api/user')).toHaveLength(1);
  expect(f.specs.filter(s => phase === 'begin' ? s.path === '/api/transfers' : s.path.endsWith('/complete'))).toHaveLength(1);
  const recovery = f.specs.find(s => s.path === '/api/user')!;
  expect(recovery.method).toBe('GET');
  expect(recovery.body).toBeUndefined();
  if (phase === 'complete') expect(f.specs.filter(s => s.method === 'DELETE').at(-1)?.path).toBe('/api/transfers/upload-1');
});

it('returns aborted when recovery enters global expiry instead of creating a second local failure', async () => {
  const f = fixture();
  f.failure.mockImplementation(request => {
    if (request.path === '/api/user') { f.session.abort(); f.setCurrent(null); return { kind: 'http', status: 401, code: 'ACCESS_EXPIRED' }; }
    return { kind: 'http', status: 401, code: 'ACCESS_EXPIRED' };
  });
  expect(await createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(context, f.source, { signal: new AbortController().signal })).toEqual({ ok: false, error: { kind: 'aborted' } });
});

it('uses an independent lazy bounded cleanup signal after user cancellation while keeping the session lease', async () => {
  const f = fixture();
  const waiting = deferred<Uint8Array>();
  f.source.size = 1;
  vi.mocked(f.source.read).mockReturnValue(waiting.promise);
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  const user = new AbortController();
  const pending = createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(context, f.source, { signal: user.signal });
  await vi.waitFor(() => expect(f.source.read).toHaveBeenCalled());
  expect(timeout).not.toHaveBeenCalled();
  user.abort();
  expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
  const cleanup = f.specs.find(s => s.method === 'DELETE')!;
  expect(cleanup.signal?.aborted).toBe(false);
  expect(cleanup.signal).not.toBe(user.signal);
  expect(timeout).toHaveBeenCalledWith(5_000);
  f.session.abort();
  expect(cleanup.signal?.aborted).toBe(true);
  waiting.resolve(new Uint8Array([0]));
  timeout.mockRestore();
});

it('downloads using only scope query and the server-decoded safe filename', async () => {
  const f = fixture();
  const outcome = await createTransferApi(f.client, f.getContext, f.getSessionSignal).download(context, 'upload-1');
  expect(outcome).toMatchObject({ ok: true, data: { filename: 'safe.json', contentType: 'application/octet-stream' } });
  expect(f.specs[0]).toMatchObject({ path: '/api/transfers/upload-1/download', method: 'GET', query: { scopeKind: 'workspace', scopeId: 'north' } });
  expect(f.specs[0].body).toBeUndefined();
});

it('retains the real client single renewal coordinator for safe GET recovery and download replay', async () => {
  const session = new AbortController();
  let fresh = false;
  const fetch = vi.fn<typeof globalThis.fetch>(async url => {
    const path = new URL(String(url)).pathname;
    if (path === '/api/transfers') return Response.json({ code: 'ACCESS_EXPIRED', data: null, message: 'Expired' }, { status: 401 });
    if (!fresh) return Response.json({ code: 'ACCESS_EXPIRED', data: null, message: 'Expired' }, { status: 401 });
    if (path === '/api/user') return Response.json({ code: 0, data: { id: 'owner', name: 'Owner', roles: [], workspaces: [{ kind: 'workspace', id: 'north' }] }, message: 'OK' });
    return new Response('file', { headers: { 'Content-Type': 'application/octet-stream' } });
  });
  const renew = vi.fn(async () => { fresh = true; return { ok: true as const, data: undefined }; });
  const client = createRequestClient({ mode: 'enabled', baseURL: 'https://injected.invalid/', fetch, credentialsProvider: () => ({ credentials: 'omit' }), activityReporter() {}, errorNormalizer: error => error, getGeneration: () => 7, renewal: { shouldRenew: isAccessExpired, renew } });
  try {
    const f = fixture();
    const api = createTransferApi(client, () => context, () => session.signal);
    expect(await api.upload(context, f.source, { signal: new AbortController().signal })).toMatchObject({ ok: false, error: { code: 'TRANSFER_RECONFIRM' } });
    expect(renew).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.filter(([url]) => new URL(String(url)).pathname === '/api/transfers')).toHaveLength(1);
    fresh = false;
    expect((await api.download(context, 'upload-1')).ok).toBe(true);
    expect(renew).toHaveBeenCalledTimes(2);
  } finally { client.dispose(); }
});

it.each(['not-a-mime', 'text/plain\r\nx:1', 'text/plain; charset="unterminated', 'text/plain; a=one; A=two'])(
  'rejects invalid source MIME %s before beginning a session', async contentType => {
    const f = fixture();
    f.source.contentType = contentType;
    expect(await createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(context, f.source, { signal: new AbortController().signal })).toMatchObject({ ok: false, error: { kind: 'protocol' } });
    expect(f.execute).not.toHaveBeenCalled();
  },
);

it('retries best-effort cleanup only once after restoring an expired write and never replays complete', async () => {
  const f = fixture();
  let restored = false;
  const normal = f.respond.getMockImplementation()!;
  f.respond.mockImplementation(request => { if (request.path === '/api/user') restored = true; return normal(request); });
  f.failure.mockImplementation(request => request.path.endsWith('/complete') || (request.method === 'DELETE' && !restored) ? { kind: 'http', status: 401, code: 'ACCESS_EXPIRED' } : undefined);
  expect(await createTransferApi(f.client, f.getContext, f.getSessionSignal).upload(context, f.source, { signal: new AbortController().signal })).toMatchObject({ ok: false, error: { code: 'TRANSFER_RECONFIRM' } });
  await vi.waitFor(() => expect(f.specs.filter(s => s.method === 'DELETE')).toHaveLength(2));
  expect(f.specs.filter(s => s.path.endsWith('/complete'))).toHaveLength(1);
  for (const spec of f.specs.filter(s => s.method === 'DELETE')) {
    expect(spec.path).toBe('/api/transfers/upload-1');
    expect(spec.allowReplay).toBe(false);
    expect(spec.signal?.aborted).toBe(false);
  }
});
it.each<RequestError>([
 {kind:'transport',code:'NETWORK_UNAVAILABLE'},
 {kind:'http',status:503,code:'SERVICE_UNAVAILABLE'},
 {kind:'http',status:403,code:'DENIED'},
 {kind:'protocol',code:'INVALID_RECOVERY_RESPONSE'},
])('preserves a recovery failure while the genuine session remains active: $kind $status',async failure=>{
 const f=fixture();f.failure.mockImplementation(request=>request.path==='/api/transfers'?{kind:'http',status:401,code:'ACCESS_EXPIRED'}:request.path==='/api/user'?failure:undefined);
 const result=await createTransferApi(f.client,f.getContext,f.getSessionSignal).upload(context,f.source,{signal:new AbortController().signal});
 expect(result).toEqual({ok:false,error:failure});expect(f.session.signal.aborted).toBe(false);expect(f.getContext()).toEqual(context);expect(f.specs.map(spec=>[spec.method,spec.path])).toEqual([['POST','/api/transfers'],['GET','/api/user']]);
});
