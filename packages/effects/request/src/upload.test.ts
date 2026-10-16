import { expect, it, vi } from 'vitest';
import type { RequestOutcome } from './errors';
import type { UploadPorts, UploadSource } from './types';
import { uploadChunks } from './upload';
import { deferred } from './test-helpers';
import type { UploadAck } from './types';

const ok = <T>(data: T): RequestOutcome<T> => ({ ok: true, data });
function setup(size = 0) {
  const source: UploadSource = { name: 'file.bin', contentType: 'application/octet-stream', size, read: vi.fn(async (start, end) => new Uint8Array(end - start)) };
  const ports = {
    begin: vi.fn<UploadPorts<string>['begin']>(async () => ok({ uploadId: 'upload' })),
    chunk: vi.fn<UploadPorts<string>['chunk']>(async input => ok({ index: input.index, acknowledgedBytes: input.offset + Buffer.from(input.base64, 'base64').length })),
    complete: vi.fn<UploadPorts<string>['complete']>(async () => ok('file')),
    cancel: vi.fn<UploadPorts<string>['cancel']>(async () => ok(undefined)),
  };
  const controller = new AbortController();
  const options = { signal: controller.signal, assertCurrent: vi.fn(), createCleanupSignal: vi.fn(() => new AbortController().signal), onProgress: vi.fn() };
  return { source, ports, controller, options };
}

it('uploads an empty file without reading a part and completes explicitly', async () => {
  const { source, ports, options } = setup();
  expect(await uploadChunks(source, ports, options)).toEqual(ok('file'));
  expect(source.read).not.toHaveBeenCalled();
  expect(ports.chunk).not.toHaveBeenCalled();
  expect(ports.complete).toHaveBeenCalledWith('upload', options.signal);
  expect(options.onProgress.mock.calls.map(([p]) => p.phase)).toEqual(['uploading', 'completing', 'complete']);
  expect(options.createCleanupSignal).not.toHaveBeenCalled();
});

it('reads serial 32 KiB parts and only advances bytes after exact cumulative ACK, then completes separately', async () => {
  const { source, ports, options } = setup(32_769);
  const first = deferred<RequestOutcome<UploadAck>>();
  const second = deferred<RequestOutcome<UploadAck>>();
  const complete = deferred<RequestOutcome<string>>();
  ports.chunk.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  ports.complete.mockReturnValue(complete.promise);
  const pending = uploadChunks(source, ports, options);
  await vi.waitFor(() => expect(ports.chunk).toHaveBeenCalledTimes(1));
  expect(source.read).toHaveBeenCalledTimes(1);
  expect(source.read).toHaveBeenCalledWith(0, 32_768, options.signal);
  expect(options.onProgress.mock.calls.map(([p]) => p.acknowledgedBytes)).toEqual([0]);
  const input = ports.chunk.mock.calls[0][0];
  expect(input).toMatchObject({ uploadId: 'upload', index: 0, offset: 0 });
  expect(input.base64).toHaveLength(43_692);
  expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(65_536);
  expect(Buffer.from(input.base64, 'base64')).toEqual(Buffer.alloc(32_768));
  first.resolve(ok({ index: 0, acknowledgedBytes: 32_768 }));
  await vi.waitFor(() => expect(ports.chunk).toHaveBeenCalledTimes(2));
  expect(source.read).toHaveBeenLastCalledWith(32_768, 32_769, options.signal);
  expect(ports.chunk.mock.calls[1][0]).toEqual({ uploadId: 'upload', index: 1, offset: 32_768, base64: 'AA==' });
  expect(options.onProgress).toHaveBeenLastCalledWith({ acknowledgedBytes: 32_768, totalBytes: 32_769, phase: 'uploading' });
  second.resolve(ok({ index: 1, acknowledgedBytes: 32_769 }));
  await vi.waitFor(() => expect(ports.complete).toHaveBeenCalledOnce());
  expect(options.onProgress).toHaveBeenLastCalledWith({ acknowledgedBytes: 32_769, totalBytes: 32_769, phase: 'completing' });
  expect(options.onProgress.mock.calls.some(([p]) => p.phase === 'complete')).toBe(false);
  complete.resolve({ ok: false, error: { kind: 'http', status: 503 } });
  expect(await pending).toEqual({ ok: false, error: { kind: 'http', status: 503 } });
  expect(options.onProgress.mock.calls.some(([p]) => p.phase === 'complete')).toBe(false);
  expect(ports.cancel).toHaveBeenCalledOnce();
});

it.each([
  { index: 1, acknowledgedBytes: 32_768 },
  { index: 0, acknowledgedBytes: 32_767 },
  { index: 0, acknowledgedBytes: 32_769 },
  { index: 0, acknowledgedBytes: -1 },
  { index: 0, acknowledgedBytes: NaN },
])('rejects inaccurate first ACK %j without progress or complete', async ack => {
  const { source, ports, options } = setup(32_769);
  ports.chunk.mockResolvedValue(ok(ack));
  expect(await uploadChunks(source, ports, options)).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  expect(ports.chunk).toHaveBeenCalledOnce();
  expect(ports.complete).not.toHaveBeenCalled();
  expect(options.onProgress.mock.calls.map(([p]) => p.acknowledgedBytes)).toEqual([0]);
  expect(ports.cancel).toHaveBeenCalledOnce();
});

it.each([
  { index: 0, acknowledgedBytes: 32_768 },
  { index: 1, acknowledgedBytes: 0 },
])('rejects duplicate or regressing second ACK %j', async ack => {
  const { source, ports, options } = setup(32_769);
  ports.chunk.mockResolvedValueOnce(ok({ index: 0, acknowledgedBytes: 32_768 })).mockResolvedValueOnce(ok(ack));
  expect(await uploadChunks(source, ports, options)).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  expect(options.onProgress.mock.calls.map(([p]) => p.acknowledgedBytes)).toEqual([0, 32_768]);
  expect(ports.complete).not.toHaveBeenCalled();
});

it.each([0, 2])('rejects a %i-byte read for a one-byte part', async length => {
  const { source, ports, options } = setup(1);
  vi.mocked(source.read).mockResolvedValue(new Uint8Array(length));
  expect(await uploadChunks(source, ports, options)).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  expect(ports.chunk).not.toHaveBeenCalled();
  expect(ports.complete).not.toHaveBeenCalled();
});

it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid source size %s before beginning', async size => {
  const { source, ports, options } = setup(size);
  expect(await uploadChunks(source, ports, options)).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  expect(ports.begin).not.toHaveBeenCalled();
});

it('does no work for a pre-aborted user signal', async () => {
  const { source, ports, options, controller } = setup(1);
  controller.abort();
  expect(await uploadChunks(source, ports, options)).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(ports.begin).not.toHaveBeenCalled();
  expect(options.onProgress).not.toHaveBeenCalled();
});

it.each(['begin', 'read', 'chunk', 'complete'] as const)('settles aborted promptly when %s ignores the signal and suppresses its late result', async stage => {
  const { source, ports, options, controller } = setup(stage === 'complete' ? 0 : 1);
  const waiting = deferred<void>();
  const original = stage === 'read' ? source.read : ports[stage];
  if (stage === 'begin') ports.begin.mockImplementationOnce(() => waiting.promise.then(() => ok({ uploadId: 'late-upload' })));
  else if (stage === 'read') vi.mocked(source.read).mockImplementationOnce(() => waiting.promise.then(() => new Uint8Array([0])));
  else if (stage === 'chunk') ports.chunk.mockImplementationOnce(() => waiting.promise.then(() => ok({ index: 0, acknowledgedBytes: 1 })));
  else ports.complete.mockImplementationOnce(() => waiting.promise.then(() => ok('late-file')));
  const pending = uploadChunks(source, ports, options);
  let result: RequestOutcome<string> | undefined;
  void pending.then(value => { result = value; });
  await vi.waitFor(() => expect(vi.mocked(original)).toHaveBeenCalled());
  // A microtask drain proves prompt settlement without a timeout race or waiting for the ignored signal.
  controller.abort();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const atAbort = result;
  const progressCount = options.onProgress.mock.calls.length;
  waiting.resolve();
  await pending;
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(atAbort).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(options.onProgress).toHaveBeenCalledTimes(progressCount);
  expect(options.onProgress.mock.calls.some(([p]) => p.phase === 'complete')).toBe(false);
  if (stage === 'read' || stage === 'begin') expect(ports.chunk).not.toHaveBeenCalled();
  if (stage !== 'complete') expect(ports.complete).not.toHaveBeenCalled();
  expect(options.createCleanupSignal).toHaveBeenCalledOnce();
  expect(ports.cancel.mock.calls[0][1]).not.toBe(options.signal);
  expect(ports.cancel.mock.calls[0][1].aborted).toBe(false);
});

it('aborts between ACK and the next part when its lease is no longer current, without canceling another lease', async () => {
  const { source, ports, options } = setup(32_769);
  let current = true;
  options.assertCurrent.mockImplementation(() => { if (!current) throw Error('retired'); });
  ports.chunk.mockImplementationOnce(async () => { current = false; return ok({ index: 0, acknowledgedBytes: 32_768 }); });
  expect(await uploadChunks(source, ports, options)).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(source.read).toHaveBeenCalledOnce();
  expect(ports.chunk).toHaveBeenCalledOnce();
  expect(ports.cancel).not.toHaveBeenCalled();
  expect(options.createCleanupSignal).not.toHaveBeenCalled();
  expect(options.onProgress.mock.calls.map(([p]) => p.acknowledgedBytes)).toEqual([0]);
});

it.each(['uploading', 'completing', 'complete'])('treats an onProgress exception during %s as protocol failure', async phase => {
  const { source, ports, options } = setup(1);
  options.onProgress.mockImplementation(progress => { if (progress.phase === phase) throw Error('consumer failure'); });
  expect(await uploadChunks(source, ports, options)).toMatchObject({ ok: false, error: { kind: 'protocol' } });
  if (phase === 'uploading') expect(ports.chunk).not.toHaveBeenCalled();
  if (phase !== 'complete') expect(ports.complete).not.toHaveBeenCalled();
  expect(ports.cancel).toHaveBeenCalledOnce();
});

it('keeps the transfer failure when best-effort cleanup fails or ignores its bounded signal', async () => {
  const { source, ports, options } = setup(1);
  const failure = { ok: false as const, error: { kind: 'http' as const, status: 409, code: 'PART_REJECTED' } };
  ports.chunk.mockResolvedValue(failure);
  ports.cancel.mockRejectedValue(Error('cleanup unavailable'));
  expect(await uploadChunks(source, ports, options)).toEqual(failure);
  expect(options.createCleanupSignal).toHaveBeenCalledOnce();
  expect(ports.cancel).toHaveBeenCalledOnce();
  expect(options.onProgress.mock.calls.some(([p]) => p.phase === 'complete')).toBe(false);
});

it('encodes only the actual view bytes and reports complete only after complete succeeds', async () => {
  const { source, ports, options } = setup(3);
  vi.mocked(source.read).mockResolvedValue(new Uint8Array([99, 0, 127, 255, 99]).subarray(1, 4));
  expect(await uploadChunks(source, ports, options)).toEqual(ok('file'));
  expect(ports.chunk.mock.calls[0][0]).toEqual({ uploadId: 'upload', index: 0, offset: 0, base64: 'AH//' });
  expect(options.onProgress.mock.calls.map(([p]) => p)).toEqual([
    { acknowledgedBytes: 0, totalBytes: 3, phase: 'uploading' },
    { acknowledgedBytes: 3, totalBytes: 3, phase: 'uploading' },
    { acknowledgedBytes: 3, totalBytes: 3, phase: 'completing' },
    { acknowledgedBytes: 3, totalBytes: 3, phase: 'complete' },
  ]);
  expect(ports.cancel).not.toHaveBeenCalled();
  expect(options.createCleanupSignal).not.toHaveBeenCalled();
});

it.each(['last-ack', 'completing'])('stops before complete when canceled during %s', async stage => {
  const { source, ports, options, controller } = setup(1);
  options.onProgress.mockImplementation(progress => {
    if ((stage === 'last-ack' && progress.phase === 'uploading' && progress.acknowledgedBytes === 1) ||
      (stage === 'completing' && progress.phase === 'completing')) controller.abort();
  });
  expect(await uploadChunks(source, ports, options)).toEqual({ ok: false, error: { kind: 'aborted' } });
  expect(ports.complete).not.toHaveBeenCalled();
  expect(options.onProgress.mock.calls.some(([p]) => p.phase === 'complete')).toBe(false);
  expect(ports.cancel).toHaveBeenCalledOnce();
});

it('preserves a begin failure without guessing an upload id or creating cleanup', async () => {
  const { source, ports, options } = setup(1);
  const failure = { ok: false as const, error: { kind: 'http' as const, status: 401, code: 'ACCESS_EXPIRED' } };
  ports.begin.mockResolvedValue(failure);
  expect(await uploadChunks(source, ports, options)).toEqual(failure);
  expect(ports.begin).toHaveBeenCalledOnce();
  expect(source.read).not.toHaveBeenCalled();
  expect(options.onProgress).not.toHaveBeenCalled();
  expect(ports.cancel).not.toHaveBeenCalled();
  expect(options.createCleanupSignal).not.toHaveBeenCalled();
});

it('does not block the failed transfer on cleanup that ignores even its own signal', async () => {
  const { source, ports, options } = setup(1);
  const cleanup = new AbortController();
  const waiting = deferred<RequestOutcome<void>>();
  const failure = { ok: false as const, error: { kind: 'http' as const, status: 503 } };
  ports.chunk.mockResolvedValue(failure);
  ports.cancel.mockReturnValue(waiting.promise);
  options.createCleanupSignal.mockReturnValue(cleanup.signal);
  expect(await uploadChunks(source, ports, options)).toEqual(failure);
  cleanup.abort();
  expect(ports.cancel).toHaveBeenCalledWith('upload', cleanup.signal);
  waiting.reject(Error('late cleanup error'));
  await Promise.resolve();
});

it('removes user cancellation listeners after settlement', async () => {
  const { source, ports, options } = setup(1);
  const add = vi.spyOn(options.signal, 'addEventListener');
  const remove = vi.spyOn(options.signal, 'removeEventListener');
  await uploadChunks(source, ports, options);
  expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
});
