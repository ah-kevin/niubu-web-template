import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
export type PlaygroundRuntimeOwner = { listen(): Promise<unknown>; close(): Promise<void> };
export type PlaygroundRuntimePorts = {
  createServer(root: string): Promise<PlaygroundRuntimeOwner>;
  fetch: typeof globalThis.fetch;
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};
export type PlaygroundRuntimeResult = { frontendURL: string; healthStatus: number; echoStatus: number; cleaned: true };
export class PlaygroundRuntimeDeadlineError extends Error {
  readonly cleanup: Promise<void>;
  constructor(cleanup: Promise<void>) {
    super('Playground runtime proof deadline exceeded');
    this.name = 'PlaygroundRuntimeDeadlineError';
    this.cleanup = cleanup;
  }
}
const frontendURL = 'http://127.0.0.1:5174';
const defaultPorts: PlaygroundRuntimePorts = {
  async createServer(root) {
    if (process.env.VITE_BACKEND_MOCK === '0') throw Error('Runtime proof requires the owned mock plugin');
    return createServer({
      root: resolve(root, 'apps/playground'),
      configFile: resolve(root, 'apps/playground/vite.config.ts'),
      server: { host: '127.0.0.1', port: 5174, strictPort: true },
    });
  },
  fetch: (...args) => globalThis.fetch(...args),
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function responseData(value: unknown, label: string) {
  if (!record(value) || value.code !== 0 || typeof value.message !== 'string' || !record(value.data))
    throw Error('Playground ' + label + ' response invalid');
  return value.data;
}
/** Explicit local proof only. Default unit/check/CI paths never call this entry. */
export async function verifyPlaygroundRuntime({
  root,
  timeoutMs = 30_000,
  ports = defaultPorts,
}: {
  root: string;
  timeoutMs?: number;
  ports?: PlaygroundRuntimePorts;
}): Promise<PlaygroundRuntimeResult> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw Error('Invalid runtime proof timeout');
  let cleanupComplete!: () => void, cleanupFailed!: (error: unknown) => void;
  const cleanup = new Promise<void>((resolve, reject) => {
    cleanupComplete = resolve;
    cleanupFailed = reject;
  });
  // Keep an observable rejection for callers without creating an unhandled rejection
  // when construction settles after the operation has already timed out.
  void cleanup.catch(() => {});
  const controller = new AbortController(),
    deadline = ports.now() + timeoutMs,
    error = new PlaygroundRuntimeDeadlineError(cleanup);
  const assertActive = () => {
    if (controller.signal.aborted || ports.now() >= deadline) throw error;
  };
  let timer: unknown;
  const expired = new Promise<never>((_, reject) => {
    timer = ports.setTimeout(() => {
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  async function within<T>(operation: () => Promise<T>): Promise<T> {
    assertActive();
    const value = await Promise.race([Promise.resolve().then(operation), expired]);
    assertActive();
    return value;
  }
  let owner: PlaygroundRuntimeOwner | undefined,
    result: PlaygroundRuntimeResult | undefined,
    failure: unknown,
    failed = false,
    creationStarted = false;
  const request = (path: string) =>
    within(() =>
      ports.fetch(frontendURL + path, {
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'error',
        credentials: 'omit',
      }),
    );
  try {
    owner = await within(async () => {
      creationStarted = true;
      let created: PlaygroundRuntimeOwner;
      try {
        created = await ports.createServer(resolve(root));
      } catch (cause) {
        if (controller.signal.aborted) cleanupFailed(cause);
        else cleanupComplete();
        throw cause;
      }
      if (controller.signal.aborted || ports.now() >= deadline) {
        controller.abort(error);
        try {
          await created.close();
          cleanupComplete();
        } catch (cause) {
          cleanupFailed(cause);
          throw new AggregateError([error, cause], 'Runtime construction expired and owned cleanup failed', { cause });
        }
        throw error;
      }
      owner = created;
      return created;
    });
    await within(() => owner!.listen());
    const html = await request('/');
    if (html.status !== 200 || !(await within(() => html.text())).includes('/src/main.tsx'))
      throw Error('Playground HTML entry invalid');
    const health = await request('/api/health');
    if (health.status !== 200) throw Error('Playground health HTTP status invalid');
    const healthData = responseData(await within(() => health.json()), 'health');
    if (healthData.status !== 'ok') throw Error('Playground health response invalid');
    const echo = await request('/api/demo/echo?value=stage8-http-proof&query=one&query=two');
    if (echo.status !== 200) throw Error('Playground echo HTTP status invalid');
    const echoData = responseData(await within(() => echo.json()), 'echo');
    if (
      echoData.value !== 'stage8-http-proof' ||
      !Array.isArray(echoData.query) ||
      echoData.query.length !== 2 ||
      echoData.query[0] !== 'one' ||
      echoData.query[1] !== 'two'
    )
      throw Error('Playground echo response invalid');
    assertActive();
    result = { frontendURL, healthStatus: health.status, echoStatus: echo.status, cleaned: true };
  } catch (cause) {
    failed = true;
    failure = cause;
  } finally {
    ports.clearTimeout(timer);
    controller.abort(error);
    if (owner) {
      try {
        await owner.close();
        cleanupComplete();
      } catch (cause) {
        cleanupFailed(cause);
        failure = failed
          ? new AggregateError([failure, cause], 'Runtime verification and owned cleanup failed', { cause })
          : cause;
        failed = true;
      }
    } else if (!creationStarted) cleanupComplete();
  }
  if (failed) throw failure;
  if (!result) throw Error('Runtime verification produced no result');
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void verifyPlaygroundRuntime({ root: process.cwd() })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Playground runtime proof failed');
      process.exitCode = 1;
      if (error instanceof PlaygroundRuntimeDeadlineError)
        void error.cleanup.catch(() => {
          console.error('Playground late owner completion or cleanup failed');
          process.exitCode = 1;
        });
    });
}
