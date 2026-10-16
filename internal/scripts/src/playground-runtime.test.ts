import { afterEach, expect, it, vi } from 'vitest';
import { verifyPlaygroundRuntime, type PlaygroundRuntimePorts } from './playground-runtime.ts';
afterEach(() => vi.useRealTimers());
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
function fixture() {
  const responses = [
    new Response('<!doctype html><script type="module" src="/src/main.tsx"></script>'),
    json({ code: 0, data: { status: 'ok' }, message: 'ok' }),
    json({ code: 0, data: { value: 'stage8-http-proof', query: ['one', 'two'] }, message: 'ok' }),
  ];
  const owner = { listen: vi.fn(async () => {}), close: vi.fn(async () => {}) };
  const fetcher = vi.fn<typeof fetch>(async () => {
    const value = responses.shift();
    if (!value) throw Error('Unexpected request');
    return value;
  });
  const ports: PlaygroundRuntimePorts = {
    createServer: vi.fn(async () => owner),
    fetch: fetcher,
    now: () => Date.now(),
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  return { responses, owner, fetcher, ports };
}
it('checks real HTML and both canonical proxy replies before reporting owned cleanup', async () => {
  const f = fixture();
  const result = await verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports });
  expect(result).toEqual({ frontendURL: 'http://127.0.0.1:5174', healthStatus: 200, echoStatus: 200, cleaned: true });
  expect(f.owner.listen).toHaveBeenCalledOnce();
  expect(f.owner.close).toHaveBeenCalledOnce();
  expect(f.fetcher).toHaveBeenCalledTimes(3);
  expect(f.fetcher).toHaveBeenNthCalledWith(
    3,
    'http://127.0.0.1:5174/api/demo/echo?value=stage8-http-proof&query=one&query=two',
    expect.objectContaining({
      cache: 'no-store',
      redirect: 'error',
      credentials: 'omit',
      signal: expect.any(AbortSignal),
    }),
  );
  for (const [, init] of f.fetcher.mock.calls) expect(init?.signal?.aborted).toBe(true);
});
it('rejects a nonzero health envelope and closes its owner', async () => {
  const f = fixture();
  f.responses[1] = json({ code: 42, data: { status: 'ok' }, message: 'not ready' });
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(/health/i);
  expect(f.owner.close).toHaveBeenCalledOnce();
  expect(f.fetcher).toHaveBeenCalledTimes(2);
});
it.each([
  { code: '0', data: { status: 'ok' }, message: 'ok' },
  { code: 0, data: null, message: 'ok' },
  { code: 0, data: { status: 'not-ready' }, message: 'ok' },
  { code: 0, data: { status: 'ok' }, message: 1 },
])('rejects a malformed health reply %# without logging its payload', async body => {
  const f = fixture();
  f.responses[1] = json(body);
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(/health/i);
  expect(f.owner.close).toHaveBeenCalledOnce();
});
it.each([
  { value: 'wrong', query: ['one', 'two'] },
  { value: 'stage8-http-proof', query: ['one'] },
  { value: 'stage8-http-proof', query: 'one,two' },
])('rejects an incorrect echo proof %#', async data => {
  const f = fixture();
  f.responses[2] = json({ code: 0, data, message: 'ok' });
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(/echo/i);
  expect(f.owner.close).toHaveBeenCalledOnce();
});
it.each([0, 1])('rejects unsuccessful HTTP response %#', async at => {
  const f = fixture();
  f.responses[at] = new Response('unavailable', { status: 503 });
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(
    at === 0 ? /HTML/ : /health/,
  );
  expect(f.owner.close).toHaveBeenCalledOnce();
});
it('does not accept unrelated HTML as the actual playground entry', async () => {
  const f = fixture();
  f.responses[0] = new Response('<html>Another server</html>');
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(/HTML/);
  expect(f.owner.close).toHaveBeenCalledOnce();
});
it('propagates port/listen failure and never probes an existing service', async () => {
  const f = fixture();
  f.owner.listen.mockRejectedValue(new Error('Port 5174 already in use'));
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(/Port/);
  expect(f.owner.close).toHaveBeenCalledOnce();
  expect(f.fetcher).not.toHaveBeenCalled();
});
it('propagates construction failure without inventing an owner', async () => {
  const f = fixture();
  f.ports.createServer = vi.fn(async () => {
    throw Error('construction failed');
  });
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(/construction/);
  expect(f.owner.close).not.toHaveBeenCalled();
  expect(f.fetcher).not.toHaveBeenCalled();
});
it.each(['listen', 'fetch', 'body'] as const)('enforces one deadline across %s and closes its owner', async phase => {
  vi.useFakeTimers();
  const f = fixture();
  if (phase === 'listen') f.owner.listen.mockImplementation(() => new Promise(() => {}));
  if (phase === 'fetch') f.fetcher.mockImplementation(() => new Promise(() => {}));
  if (phase === 'body') f.responses[0] = new Response(new ReadableStream({ start() {} }));
  const assertion = expect(
    verifyPlaygroundRuntime({ root: '/virtual/template', timeoutMs: 10, ports: f.ports }),
  ).rejects.toThrow(/deadline/);
  await vi.advanceTimersByTimeAsync(10);
  await assertion;
  expect(f.owner.close).toHaveBeenCalledOnce();
});
it('releases a late construction result after the deadline instead of leaving its owner active', async () => {
  vi.useFakeTimers();
  const f = fixture();
  let complete!: (owner: typeof f.owner) => void;
  f.ports.createServer = () =>
    new Promise(resolve => {
      complete = resolve;
    });
  const assertion = expect(
    verifyPlaygroundRuntime({ root: '/virtual/template', timeoutMs: 10, ports: f.ports }),
  ).rejects.toThrow(/deadline/);
  await vi.advanceTimersByTimeAsync(10);
  await assertion;
  complete(f.owner);
  await vi.runAllTimersAsync();
  expect(f.owner.close).toHaveBeenCalledOnce();
  expect(f.owner.listen).not.toHaveBeenCalled();
});
it('does not report cleaned success when close fails', async () => {
  const f = fixture();
  f.owner.close.mockRejectedValue(new Error('owned close failed'));
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(
    /owned close failed/,
  );
});
it('preserves verification and cleanup errors together', async () => {
  const f = fixture();
  f.responses[1] = json({ code: 9, data: { status: 'ok' }, message: 'no' });
  f.owner.close.mockRejectedValue(new Error('owned close failed'));
  let failure: unknown;
  try {
    await verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports });
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors).toHaveLength(2);
});
it.each([0, -1, 30_001, Number.NaN])(
  'refuses an invalid or extended timeout %s before creating an owner',
  async timeoutMs => {
    const f = fixture();
    await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports, timeoutMs })).rejects.toThrow(
      /timeout/,
    );
    expect(f.ports.createServer).not.toHaveBeenCalled();
  },
);

it('rejects final body completion after the same deadline before a timer can execute', async () => {
  const f = fixture();
  let now = 0;
  f.ports.now = () => now;
  const response = f.responses[2],
    decode = response.json.bind(response);
  vi.spyOn(response, 'json').mockImplementation(async () => {
    const data = await decode();
    now = 30_001;
    return data;
  });
  await expect(verifyPlaygroundRuntime({ root: '/virtual/template', ports: f.ports })).rejects.toThrow(/deadline/);
  expect(f.owner.close).toHaveBeenCalledOnce();
});
it('exposes a late construction cleanup rejection on the returned deadline error', async () => {
  vi.useFakeTimers();
  const f = fixture();
  let complete!: (owner: typeof f.owner) => void;
  const cleanupFailure = new Error('late owned cleanup failed');
  f.owner.close.mockRejectedValue(cleanupFailure);
  f.ports.createServer = () =>
    new Promise(resolve => {
      complete = resolve;
    });
  const outcome = verifyPlaygroundRuntime({ root: '/virtual/template', timeoutMs: 10, ports: f.ports }).then(
    () => ({ error: undefined }),
    error => ({ error }),
  );
  await vi.advanceTimersByTimeAsync(10);
  const { error } = await outcome;
  expect(error.message).toMatch(/deadline/);
  const available = error.cleanup instanceof Promise;
  const observed = available
    ? error.cleanup.then(
        () => ({ error: undefined }),
        (error: unknown) => ({ error }),
      )
    : undefined;
  complete(f.owner);
  await vi.runAllTimersAsync();
  expect(f.owner.close).toHaveBeenCalledOnce();
  expect(f.owner.listen).not.toHaveBeenCalled();
  expect(available).toBe(true);
  expect((await observed)?.error).toBe(cleanupFailure);
});
