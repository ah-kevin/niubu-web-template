import { spawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

export interface BackendMockOptions {
  workspaceRoot: string;
  enabled: boolean;
  port?: number;
}

/** OS/network boundaries are replaceable so unit tests never start a service. */
export interface BackendMockRuntime {
  checkPortAvailable: (port: number) => Promise<void>;
  resolveCli: (workspaceRoot: string) => string;
  spawn: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  fetch: typeof globalThis.fetch;
  kill: (pid: number, signal: NodeJS.Signals | 0) => boolean;
}

const runtime: BackendMockRuntime = {
  checkPortAvailable: port =>
    new Promise((done, reject) => {
      const probe = createServer();
      probe.once('error', cause => reject(new Error(`Backend mock port 127.0.0.1:${port} is unavailable`, { cause })));
      probe.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
        probe.close(error => (error ? reject(error) : done()));
      });
    }),
  resolveCli: workspaceRoot => {
    const backendRequire = createRequire(resolve(workspaceRoot, 'apps/backend-mock/package.json'));
    const manifestPath = backendRequire.resolve('nitropack/package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { bin: { nitro: string } };
    return resolve(dirname(manifestPath), manifest.bin.nitro);
  },
  spawn,
  fetch: (...args) => globalThis.fetch(...args),
  kill: (pid, signal) => process.kill(pid, signal),
};

const pause = (ms: number) => new Promise<void>(done => setTimeout(done, ms));

function processMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH';
}

async function waitForHealth(port: number, signal: AbortSignal, adapters: BackendMockRuntime) {
  while (!signal.aborted) {
    try {
      const response = await adapters.fetch(`http://127.0.0.1:${port}/api/health`, {
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
function createBackendOwner({ workspaceRoot, port = 5320 }: BackendMockOptions, adapters: BackendMockRuntime) {
  let child: ChildProcess | undefined;
  let group: number | undefined;
  let closed = false;
  let starting: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let onError: ((error: Error) => void) | undefined;
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
      } finally {
        if (onError) child?.off('error', onError);
        if (onExit) child?.off('exit', onExit);
      }
    })();
    return stopping;
  }

  async function start() {
    if (closed) throw new Error('Backend mock plugin is closed');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid backend mock port');
    await adapters.checkPortAvailable(port);
    if (closed) throw new Error('Backend mock plugin closed during startup');
    controller = new AbortController();
    const signal = controller.signal;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const cli = adapters.resolveCli(workspaceRoot);
      child = adapters.spawn(process.execPath, [cli, 'dev', '--host', '127.0.0.1', '--port', String(port)], {
        cwd: resolve(workspaceRoot, 'apps/backend-mock'),
        detached: true,
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      // A failed spawn has no pid. Never synthesize a PID or discover one by port.
      if (child.pid !== undefined) {
        if (!Number.isInteger(child.pid) || child.pid <= 1 || child.pid === process.pid) {
          throw new Error('Invalid backend mock child PID');
        }
        group = child.pid;
      }
      const failed = new Promise<never>((_, reject) => {
        onError = reject;
        onExit = (code, exitSignal) =>
          reject(new Error(`Backend mock exited before readiness (code ${code}, signal ${exitSignal})`));
        // Retain this listener until cleanup: errors can also arrive after health succeeds.
        child!.on('error', onError);
        child!.once('exit', onExit);
      });
      const aborted = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      timeout = setTimeout(() => controller!.abort(new Error(`Backend mock health timed out on port ${port}`)), 15_000);
      await Promise.race([waitForHealth(port, signal, adapters), failed, aborted]);
      if (signal.aborted) throw signal.reason;
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
