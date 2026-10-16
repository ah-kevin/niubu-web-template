import { describe, expect, it, vi } from 'vitest';
import type { RequestOutcome } from './errors';
import { deferred, fakeClient, spec } from './test-helpers';
import { createRenewalCoordinator } from './renewal';
import { isAccessExpired } from './protocol';

const expired = () => Response.json({ code: 'ACCESS_EXPIRED', data: null, message: 'Expired' }, { status: 401 });
const shouldRenew = isAccessExpired;
describe('explicit renewal concurrency', () => {
  it('cancels the old renewal before a detected new generation reports activity or asks for credentials', async () => {
    let generation = 1;
    const renew = vi.fn((_signal: AbortSignal) => new Promise<RequestOutcome<void>>(() => {}));
    const observed: boolean[] = [];
    const observe = () => {
      if (generation === 2) observed.push(renew.mock.calls[0][0].aborted);
    };
    const injected = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => expired())
      .mockImplementation(async () => Response.json({ code: 0, data: 8, message: 'ok' }));
    const { client } = fakeClient({
      fetch: injected,
      getGeneration: () => generation,
      activityReporter: observe,
      credentialsProvider: () => {
        observe();
        return {};
      },
      renewal: { shouldRenew, renew },
    });
    const old = client.execute(spec);
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    generation++;
    expect(await client.execute(spec)).toEqual({ ok: true, data: 8 });
    expect(await old).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(observed).toEqual([true, true]);
  });
  it('does not invoke an injected renewal after its lifetime is synchronously disposed', async () => {
    const renew = vi.fn(async (_signal: AbortSignal): Promise<RequestOutcome<void>> => ({ ok: true, data: undefined }));
    const coordinator = createRenewalCoordinator({ shouldRenew, renew });
    const pending = coordinator.wait(1, new AbortController().signal, 0);
    coordinator.dispose();
    expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(renew).not.toHaveBeenCalled();
  });
  it('reuses a successful renewal for an overlapping request whose initial expiry arrives later', async () => {
    const late = deferred<Response>();
    const renew = vi.fn(async (_signal: AbortSignal): Promise<RequestOutcome<void>> => ({ ok: true, data: undefined }));
    const injected = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => expired())
      .mockImplementationOnce(() => late.promise)
      .mockImplementation(async () => Response.json({ code: 0, data: 7, message: 'ok' }));
    const { client } = fakeClient({ fetch: injected, renewal: { shouldRenew, renew } });
    const first = client.execute(spec),
      second = client.execute(spec);
    expect(await first).toEqual({ ok: true, data: 7 });
    late.resolve(expired());
    expect(await second).toEqual({ ok: true, data: 7 });
    expect(renew).toHaveBeenCalledTimes(1);
    expect(injected).toHaveBeenCalledTimes(4);
  });
  it('dispose settles all renewal waiters even when renew never settles or honors its signal', async () => {
    const renew = vi.fn((_signal: AbortSignal) => new Promise<RequestOutcome<void>>(() => {}));
    const { client } = fakeClient({ fetch: vi.fn(async () => expired()), renewal: { shouldRenew, renew } });
    const first = client.execute(spec),
      second = client.execute({ ...spec, activity: 'background' });
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    client.dispose();
    client.dispose();
    expect(await Promise.all([first, second])).toEqual([
      { ok: false, error: { kind: 'aborted' } },
      { ok: false, error: { kind: 'aborted' } },
    ]);
    expect(renew.mock.calls[0][0].aborted).toBe(true);
  });
  it('shares one renewal and replays each eligible request only once with fresh credentials', async () => {
    const renewed = deferred<RequestOutcome<void>>();
    const renew = vi.fn<(signal: AbortSignal) => Promise<RequestOutcome<void>>>(() => renewed.promise);
    let credentials = 0;
    const injected = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => expired())
      .mockImplementationOnce(async () => expired())
      .mockImplementation(async () => Response.json({ code: 0, data: 'fresh', message: 'ok' }));
    const { client, activityReporter } = fakeClient({
      fetch: injected,
      credentialsProvider: () => ({ headers: { 'X-Fake': String(++credentials) } }),
      renewal: { shouldRenew, renew },
    });
    const outcomes = [client.execute(spec), client.execute({ ...spec, activity: 'background' })];
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    renewed.resolve({ ok: true, data: undefined });
    expect(await Promise.all(outcomes)).toEqual([
      { ok: true, data: 'fresh' },
      { ok: true, data: 'fresh' },
    ]);
    expect(injected).toHaveBeenCalledTimes(4);
    expect(credentials).toBe(4);
    expect(activityReporter).toHaveBeenCalledTimes(1);
  });
  it('does not default-replay writes, honors explicit opt-out, and caps repeated expiry', async () => {
    for (const request of [
      { ...spec, method: 'POST' },
      { ...spec, allowReplay: false },
    ]) {
      const renew = vi.fn(async () => ({ ok: true as const, data: undefined }));
      const injected = vi.fn(async () => expired());
      expect(
        await fakeClient({ fetch: injected, renewal: { shouldRenew, renew } }).client.execute(request),
      ).toMatchObject({ ok: false, error: { code: 'ACCESS_EXPIRED' } });
      expect(injected).toHaveBeenCalledTimes(1);
      expect(renew).not.toHaveBeenCalled();
    }
    const renew = vi.fn(async () => ({ ok: true as const, data: undefined }));
    const injected = vi.fn(async () => expired());
    expect(
      await fakeClient({ fetch: injected, renewal: { shouldRenew, renew } }).client.execute({
        ...spec,
        method: 'POST',
        allowReplay: true,
      }),
    ).toMatchObject({ ok: false, error: { code: 'ACCESS_EXPIRED' } });
    expect(injected).toHaveBeenCalledTimes(2);
    expect(renew).toHaveBeenCalledTimes(1);
  });
  it('a cancelled waiter settles independently while other waiters finish', async () => {
    const renewed = deferred<RequestOutcome<void>>();
    const renew = vi.fn<(signal: AbortSignal) => Promise<RequestOutcome<void>>>(() => renewed.promise);
    const injected = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => expired())
      .mockImplementationOnce(async () => expired())
      .mockImplementation(async () => Response.json({ code: 0, data: 7, message: 'ok' }));
    const { client } = fakeClient({ fetch: injected, renewal: { shouldRenew, renew } });
    const abort = new AbortController();
    const first = client.execute({ ...spec, signal: abort.signal });
    const second = client.execute(spec);
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    abort.abort();
    expect(await first).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(renew.mock.calls[0][0].aborted).toBe(false);
    renewed.resolve({ ok: true, data: undefined });
    expect(await second).toEqual({ ok: true, data: 7 });
    expect(injected).toHaveBeenCalledTimes(3);
  });
  it('cancels an orphaned flight, ignores late renewal, and starts a new flight', async () => {
    const old = deferred<RequestOutcome<void>>();
    const fresh = deferred<RequestOutcome<void>>();
    const renew = vi
      .fn<(signal: AbortSignal) => Promise<RequestOutcome<void>>>()
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => fresh.promise);
    const injected = vi.fn(async () => expired());
    const { client } = fakeClient({ fetch: injected, renewal: { shouldRenew, renew } });
    const abort = new AbortController();
    const first = client.execute({ ...spec, signal: abort.signal });
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    abort.abort();
    expect(await first).toMatchObject({ ok: false, error: { kind: 'aborted' } });
    expect(renew.mock.calls[0][0].aborted).toBe(true);
    const second = client.execute(spec);
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(2));
    old.resolve({ ok: true, data: undefined });
    await Promise.resolve();
    expect(injected).toHaveBeenCalledTimes(2);
    fresh.resolve({ ok: false, error: { kind: 'transport', code: 'RENEW_FAILED' } });
    expect(await second).toEqual({ ok: false, error: { kind: 'transport', code: 'RENEW_FAILED' } });
  });
  it('settles all waiters after renewal rejection, clears the flight, and permits later renewal', async () => {
    const old = deferred<RequestOutcome<void>>();
    const renew = vi
      .fn()
      .mockImplementationOnce(() => old.promise)
      .mockResolvedValue({ ok: false, error: { kind: 'http', status: 403 } });
    const { client } = fakeClient({ fetch: vi.fn(async () => expired()), renewal: { shouldRenew, renew } });
    const first = client.execute(spec),
      second = client.execute(spec);
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    old.reject(Error('controlled failure'));
    for (const result of await Promise.all([first, second]))
      expect(result).toMatchObject({ ok: false, error: { kind: 'transport' } });
    expect(await client.execute(spec)).toEqual({ ok: false, error: { kind: 'http', status: 403 } });
    expect(renew).toHaveBeenCalledTimes(2);
  });
  it('generation invalidation cancels the old flight and every waiter without replay', async () => {
    let generation = 1;
    const old = deferred<RequestOutcome<void>>();
    const renew = vi.fn<(signal: AbortSignal) => Promise<RequestOutcome<void>>>(() => old.promise);
    const injected = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => expired())
      .mockImplementationOnce(async () => expired())
      .mockResolvedValue(Response.json({ code: 0, data: 'new generation', message: 'ok' }));
    const { client } = fakeClient({
      fetch: injected,
      getGeneration: () => generation,
      renewal: { shouldRenew, renew },
    });
    const first = client.execute(spec),
      second = client.execute(spec);
    await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(1));
    generation++;
    expect(await client.execute(spec)).toEqual({ ok: true, data: 'new generation' });
    expect(await Promise.all([first, second])).toEqual([
      { ok: false, error: { kind: 'aborted' } },
      { ok: false, error: { kind: 'aborted' } },
    ]);
    expect(renew.mock.calls[0][0].aborted).toBe(true);
    old.resolve({ ok: true, data: undefined });
    await Promise.resolve();
    expect(injected).toHaveBeenCalledTimes(3);
  });
  it('keeps renewal and disposal isolated between clients', async () => {
    const one = deferred<RequestOutcome<void>>(),
      two = deferred<RequestOutcome<void>>();
    const renewOne = vi.fn<(signal: AbortSignal) => Promise<RequestOutcome<void>>>(() => one.promise),
      renewTwo = vi.fn<(signal: AbortSignal) => Promise<RequestOutcome<void>>>(() => two.promise);
    const make = (renew: typeof renewOne) =>
      fakeClient({
        fetch: vi
          .fn<typeof fetch>()
          .mockImplementationOnce(async () => expired())
          .mockResolvedValue(Response.json({ code: 0, data: 7, message: 'ok' })),
        renewal: { shouldRenew, renew },
      }).client;
    const a = make(renewOne),
      b = make(renewTwo);
    const pendingA = a.execute(spec),
      pendingB = b.execute(spec);
    await vi.waitFor(() => {
      expect(renewOne).toHaveBeenCalledTimes(1);
      expect(renewTwo).toHaveBeenCalledTimes(1);
    });
    a.dispose();
    expect(await pendingA).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(renewOne.mock.calls[0][0].aborted).toBe(true);
    expect(renewTwo.mock.calls[0][0].aborted).toBe(false);
    two.resolve({ ok: true, data: undefined });
    expect(await pendingB).toEqual({ ok: true, data: 7 });
    one.resolve({ ok: true, data: undefined });
  });
});
