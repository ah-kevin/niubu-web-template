import { vi } from 'vitest';
import { createRequestClient } from './client';
import type { EnabledRequestOptions, RequestSpec } from './types';
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export const spec: RequestSpec<unknown> = {
  path: 'items',
  method: 'GET',
  activity: 'foreground',
  decode: data => data,
};
export function fakeClient(overrides: Partial<EnabledRequestOptions> = {}) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({ code: 0, data: { value: 7 }, message: 'ok' }),
  );
  const credentialsProvider = vi.fn(() => ({
    headers: { 'X-Controlled-Credential': 'fake-only' },
    credentials: 'omit' as const,
  }));
  const activityReporter = vi.fn();
  const errorNormalizer = vi.fn((error: Parameters<EnabledRequestOptions['errorNormalizer']>[0]) => error);
  const options: EnabledRequestOptions = {
    mode: 'enabled',
    baseURL: 'https://controlled.invalid/api/',
    fetch,
    credentialsProvider,
    activityReporter,
    errorNormalizer,
    getGeneration: () => 1,
    ...overrides,
  };
  return { client: createRequestClient(options), fetch, credentialsProvider, activityReporter, errorNormalizer };
}
