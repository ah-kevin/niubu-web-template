import { spawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { createServer, isIP } from 'node:net';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export interface BackendMockOptions {
  workspaceRoot: string;
  enabled: boolean;
  port?: number;
  host?: string;
  onFailure?: (error: Error) => void;
}

/** OS/network boundaries are replaceable so unit tests never start a service. */
export interface BackendMockRuntime {
  checkPortAvailable: (port: number, host: string) => Promise<void>;
  resolveCli: (workspaceRoot: string) => string;
  spawn: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  fetch: typeof globalThis.fetch;
  kill: (pid: number, signal: NodeJS.Signals | 0) => boolean;
}

const runtime: BackendMockRuntime = {
  checkPortAvailable: (port, host) =>
    new Promise((done, reject) => {
      const probe = createServer();
      probe.once('error', cause => reject(new Error(`Backend mock port ${host}:${port} is unavailable`, { cause })));
      probe.listen({ host, port, exclusive: true }, () => {
        probe.close(error => (error ? reject(error) : done()));
      });
    }),
  resolveCli: workspaceRoot => resolve(workspaceRoot, 'apps/backend-mock/dev-server.ts'),
  spawn,
  fetch: (...args) => globalThis.fetch(...args),
  kill: (pid, signal) => process.kill(pid, signal),
};

const pause = (ms: number) => new Promise<void>(done => setTimeout(done, ms));

function processMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH';
}

async function waitForHealth(port: number, host: string, signal: AbortSignal, adapters: BackendMockRuntime) {
  while (!signal.aborted) {
    try {
      const response = await adapters.fetch(`http://${isIP(host) === 6 ? `[${host}]` : host}:${port}/api/health`, {
        signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.ok) {
        const body: unknown = await response.json();
        if (
          typeof body === 'object' &&
          body !== null &&
          'code' in body &&
          body.code === 0 &&
          'data' in body &&
          typeof body.data === 'object' &&
          body.data !== null &&
          'status' in body.data &&
          body.data.status === 'ok'
        )
          return;
      } else {
        await response.body?.cancel();
      }
    } catch {
      // Connection refusal and incomplete Nitro startup are retried within the deadline.
    }
    if (!signal.aborted) await pause(100);
  }
  throw signal.reason;
}

/** One lifecycle per configured server, including restart with an inline plugin instance. */
export function createBackendOwner(
  { workspaceRoot, port = 5320, host = '127.0.0.1', onFailure }: BackendMockOptions,
  adapters: BackendMockRuntime = runtime,
) {
  let child: ChildProcess | undefined;
  let group: number | undefined;
  let closed = false;
  let ready = false;
  let shutdownFailure: Error | undefined;
  let exited: Promise<void> | undefined;
  let observeExit: (() => void) | undefined;
  let starting: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let onError: ((error: Error) => void) | undefined;
  let onMessage: ((message: unknown) => void) | undefined;
  let onExit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;

  function groupExists() {
    if (group === undefined) return false;
    try {
      adapters.kill(-group, 0);
      return true;
    } catch (error) {
      if (processMissing(error)) return false;
      throw error;
    }
  }

  async function waitForGroup(ms: number) {
    const deadline = Date.now() + ms;
    while (groupExists()) {
      if (Date.now() >= deadline) return false;
      await pause(50);
    }
    return true;
  }

  function stopProcess() {
    stopping ??= (async () => {
      try {
        if (group !== undefined && groupExists()) {
          try {
            adapters.kill(-group, 'SIGTERM');
          } catch (error) {
            if (!processMissing(error)) throw error;
          }
          // The leader exiting does not mean its Nitro descendants have exited.
          if (!(await waitForGroup(2_000))) {
            try {
              adapters.kill(-group, 'SIGKILL');
            } catch (error) {
              if (!processMissing(error)) throw error;
            }
            if (!(await waitForGroup(2_000))) {
              throw new Error(`Backend mock process group ${group} did not stop`);
            }
          }
        }
        if (group !== undefined) await exited;
        if (shutdownFailure) throw shutdownFailure;
      } finally {
        if (onError) child?.off('error', onError);
        if (onMessage) child?.off('message', onMessage);
        if (onExit) child?.off('exit', onExit);
      }
    })();
    return stopping;
  }

  async function start() {
    if (closed) throw new Error('Backend mock plugin is closed');
    parseBackendMockOptions([], { MOCK_HOST: host, MOCK_PORT: String(port) });
    await adapters.checkPortAvailable(port, host);
    if (closed) throw new Error('Backend mock plugin closed during startup');
    controller = new AbortController();
    const signal = controller.signal;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const cli = adapters.resolveCli(workspaceRoot);
      child = adapters.spawn(process.execPath, [cli, '--host', host, '--port', String(port)], {
        cwd: resolve(workspaceRoot, 'apps/backend-mock'),
        detached: true,
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
      // A failed spawn has no pid. Never synthesize a PID or discover one by port.
      if (child.pid !== undefined) {
        if (!Number.isInteger(child.pid) || child.pid <= 1 || child.pid === process.pid) {
          throw new Error('Invalid backend mock child PID');
        }
        group = child.pid;
      }
      exited = new Promise<void>(resolve => {
        observeExit = resolve;
      });
      const failed = new Promise<never>((_, reject) => {
        onError = error => {
          reject(error);
          if (ready && !closed) onFailure?.(error);
        };
        onExit = (code, exitSignal) => {
          if (closed && code !== null && code !== 0)
            shutdownFailure ??= new Error(`Owned mock cleanup failed (exit ${code})`);
          observeExit?.();
          onError!(new Error(`Backend mock exited (code ${code}, signal ${exitSignal})`));
        };
        // Retain this listener until cleanup: errors can also arrive after health succeeds.
        child!.on('error', onError);
        child!.once('exit', onExit);
      });
      const listening = new Promise<void>((resolve, reject) => {
        onMessage = message => {
          if (typeof message === 'object' && message !== null && 'type' in message) {
            if (message.type === 'mock:cleanup-failed') {
              shutdownFailure ??= new Error('Owned mock child cleanup failed');
              return;
            }
            if (message.type === 'mock:failed') {
              onError?.(new Error('Owned mock child failed'));
              return;
            }
          }
          if (
            typeof message !== 'object' ||
            message === null ||
            !('type' in message) ||
            message.type !== 'mock:listening'
          )
            return;
          if (!('host' in message) || message.host !== host || !('port' in message) || message.port !== port)
            reject(new Error('Owned mock bound an unexpected address'));
          else resolve();
        };
        child!.on('message', onMessage);
      });
      const aborted = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      timeout = setTimeout(() => controller!.abort(new Error(`Backend mock health timed out on port ${port}`)), 15_000);
      await Promise.race([listening, failed, aborted]);
      await Promise.race([waitForHealth(port, host, signal, adapters), failed, aborted]);
      if (signal.aborted) throw signal.reason;
      ready = true;
    } catch (error) {
      controller.abort(error);
      try {
        await stopProcess();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Backend mock startup and cleanup failed', {
          cause: cleanupError,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }

  return {
    started: () => starting !== undefined,
    start: () => (starting ??= start()),
    async close() {
      closed = true;
      controller?.abort(new Error('Backend mock plugin closed during startup'));
      await starting?.catch(() => {});
      await stopProcess();
    },
  };
}

export default function backendMockPlugin(options: BackendMockOptions, adapters: BackendMockRuntime = runtime): Plugin {
  const plugin: Plugin = { name: 'niubu:backend-mock', apply: 'serve' };
  if (!options.enabled) return plugin;
  const owners = new Set<ReturnType<typeof createBackendOwner>>();
  plugin.configureServer = server => {
    const owner = createBackendOwner(options, adapters);
    owners.add(owner);
    const listen = server.listen.bind(server);
    server.listen = async (...args) => {
      try {
        // Do not create a detached backend until the frontend actually owns its port.
        const running = await listen(...args);
        await owner.start();
        return running;
      } catch (error) {
        try {
          await server.close();
        } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'Vite startup and backend cleanup failed', {
            cause: cleanupError,
          });
        }
        throw error;
      }
    };
  };
  // Vite intentionally settles closeBundle failures. Its server-level hook propagates errors.
  plugin.closeServer = async ({ reason }) => {
    // Restart configures the next server before closing the previous one. Leave its
    // unstarted owner intact; it can only spawn after the new frontend starts listening.
    const selected = [...owners].filter(owner => reason !== 'restart' || owner.started());
    await Promise.all(
      selected.map(async owner => {
        await owner.close();
        owners.delete(owner);
      }),
    );
  };
  return plugin;
}

export function parseBackendMockOptions(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): { host: string; port: number } {
  let host = env.MOCK_HOST ?? '127.0.0.1';
  let portValue = env.MOCK_PORT ?? '5320';
  const supplied = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index],
      value = args[index + 1];
    if ((flag !== '--host' && flag !== '--port') || !value || supplied.has(flag))
      throw Error('Invalid mock startup option');
    supplied.add(flag);
    if (flag === '--host') host = value;
    else portValue = value;
  }
  if (
    host.length > 63 ||
    (!isIP(host) && !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(host))
  )
    throw Error('Invalid mock host');
  if (!/^[0-9]+$/.test(portValue)) throw Error('Invalid mock port');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid mock port');
  return { host, port };
}
