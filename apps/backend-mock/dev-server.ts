import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createNitro, createDevServer, prepare, build } from 'nitropack/core';

/** Disable every port fallback in the actual Nitro/listhen listener. */
export function strictListenOptions(host: string, port: number) {
  return {
    hostname: host,
    public: host === '0.0.0.0' || host === '::',
    port: {
      port,
      random: false,
      ports: [],
      portRange: [1, 0] as [number, number],
      alternativePortRange: [1, 0] as [number, number],
    },
    autoClose: false,
    showURL: false,
  };
}

async function run() {
  const args = process.argv.slice(2);
  const host = args[args.indexOf('--host') + 1];
  const port = Number(args[args.indexOf('--port') + 1]);
  if (args.length !== 4 || args[0] !== '--host' || args[2] !== '--port' || !process.send)
    throw Error('Mock child requires its standalone owner');
  let nitro: Awaited<ReturnType<typeof createNitro>> | undefined;
  let finishSetup!: () => void;
  const setup = new Promise<void>(resolve => {
    finishSetup = resolve;
  });
  let pending: Promise<void> = Promise.resolve();
  let closing: Promise<void> | undefined;
  let stopping = false;
  const report = (type: 'mock:failed' | 'mock:cleanup-failed', error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Mock child failed');
    process.exitCode = 1;
    if (process.connected) process.send?.({ type });
  };
  const unwatch = async () => {
    const config = nitro?.options._c12;
    if (config && 'unwatch' in config && typeof config.unwatch === 'function') await config.unwatch();
  };
  const close = () => {
    stopping = true;
    closing ??= setup.then(async () => {
      await pending;
      try {
        await unwatch();
        await nitro?.close();
      } catch (error) {
        report('mock:cleanup-failed', error);
        throw error;
      } finally {
        if (process.connected) process.disconnect();
      }
    });
    return closing;
  };
  const stop = () => {
    void close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.once('disconnect', stop);
  function queueReload() {
    if (stopping) return Promise.resolve();
    const next = pending.then(reload);
    pending = next.catch(() => {});
    return next;
  }
  async function reload() {
    if (stopping) return;
    if (nitro) {
      await unwatch();
      await nitro.close();
    }
    if (stopping) return;
    nitro = await createNitro(
      { rootDir: import.meta.dirname, dev: true, _cli: { command: 'dev' } },
      {
        watch: true,
        c12: {
          async onUpdate({ getDiff, newConfig }) {
            const diff = getDiff();
            if (!diff.length || stopping) return;
            try {
              if (diff.every(entry => /^runtimeConfig\.|routeRules\./.test(entry.key)))
                await nitro!.updateConfig(newConfig.config || {});
              else await queueReload();
            } catch (error) {
              report('mock:failed', error);
              stop();
              throw error;
            }
          },
        },
      },
    );
    if (stopping) return;
    nitro.hooks.hookOnce('restart', () =>
      queueReload().catch(error => {
        report('mock:failed', error);
        stop();
      }),
    );
    const server = createDevServer(nitro);
    const options = strictListenOptions(host!, port);
    const listener = await server.listen(options.port, options);
    const address = listener.server.address();
    if (!address || typeof address === 'string' || address.port !== port)
      throw Error('Owned mock listener port mismatch');
    if (stopping) return;
    process.send!({ type: 'mock:listening', host, port: address.port });
    await prepare(nitro);
    await build(nitro);
  }
  try {
    await queueReload();
  } catch (error) {
    report('mock:failed', error);
    stop();
  } finally {
    finishSetup();
    if (stopping) await close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void run().catch(error => {
    console.error(error instanceof Error ? error.message : 'Mock child startup failed');
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
}
