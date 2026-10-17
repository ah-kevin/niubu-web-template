// @vitest-environment node
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveConfig } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import backendMockPlugin, { createBackendOwner } from './backend-process.ts';
import type { BackendMockRuntime } from './backend-process.ts';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const healthy = () => new Response(JSON.stringify({ code: 0, data: { status: 'ok' }, message: 'ok' }));

function harness(announce = true) {
  const child = Object.assign(new EventEmitter(), { pid: 4242 });
  let groupAlive = false;
  let terminate = true;
  const finish = () => {
    groupAlive = false;
    child.emit('exit', 0, 'SIGTERM');
    child.emit('close', 0, 'SIGTERM');
  };
  const runtime: BackendMockRuntime = {
    checkPortAvailable: vi.fn().mockResolvedValue(undefined),
    resolveCli: vi.fn().mockReturnValue('/published/nitropack/dist/cli/index.mjs'),
    spawn: vi.fn((_command, args) => {
      groupAlive = true;
      if (announce) queueMicrotask(() => child.emit('message', { type: 'mock:listening', host: args[args.indexOf('--host') + 1], port: Number(args[args.indexOf('--port') + 1]) }));
      return child as unknown as ChildProcess;
    }),
    fetch: vi.fn().mockImplementation(async () => healthy()),
    kill: vi.fn((pid, signal) => {
      expect(pid).toBe(-4242);
      if (!groupAlive) throw Object.assign(new Error('No process'), { code: 'ESRCH' });
      if (signal !== 0 && terminate) finish();
      return true;
    }),
  };
  const plugin = backendMockPlugin({ workspaceRoot, enabled: true }, runtime);
  return { child, runtime, plugin, finish, keepAlive: () => { terminate = false; } };
}

async function start(plugin: Plugin) {
  const hook = plugin.configureServer;
  expect(hook, 'enabled serve plugin must register startup').toBeTypeOf('function');
  if (typeof hook !== 'function') throw new Error('Missing startup hook');
  const server = {
    listen: async () => server,
    close: async () => close(plugin),
  } as unknown as ViteDevServer;
  await hook.call({} as never, server);
  return server.listen();
}

async function close(plugin: Plugin) {
  const hook = plugin.closeServer;
  if (typeof hook === 'function') return hook.call({} as never, { reason: 'close' });
  if (hook) return hook.handler.call({} as never, { reason: 'close' });
}

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('reports a late owned backend failure to a standalone supervisor', async () => {
  const { runtime, child } = harness();
  const onFailure = vi.fn();
  const owner = createBackendOwner({ workspaceRoot, enabled: true, onFailure } as Parameters<typeof createBackendOwner>[0], runtime);
  await owner.start();
  child.emit('exit', 7, null);
  expect(onFailure).toHaveBeenCalledOnce();
  expect(onFailure.mock.calls[0]![0]).toBeInstanceOf(Error);
  await owner.close();
});
it('uses an IPv6 HTTP origin for an explicit IPv6 listen address', async () => {
  const { runtime } = harness();
  const owner = createBackendOwner({ workspaceRoot, enabled: true, host: '::1' }, runtime);
  await owner.start();
  expect(runtime.fetch).toHaveBeenCalledWith('http://[::1]:5320/api/health', expect.any(Object));
  await owner.close();
});

describe('backendMockPlugin lifecycle', () => {
  it('is excluded by Vite build without probing or resolving Nitro', async () => {
    const { plugin, runtime } = harness();
    const config = await resolveConfig({ configFile: false, plugins: [plugin] }, 'build');
    expect(config.plugins.map(p => p.name)).not.toContain(plugin.name);
    for (const adapter of Object.values(runtime)) expect(adapter).not.toHaveBeenCalled();
  });

  it('disabled serve performs no process, network, or resolution work even when closed', async () => {
    const { runtime } = harness();
    const plugin = backendMockPlugin({ workspaceRoot, enabled: false }, runtime);
    if (typeof plugin.configureServer === 'function') await start(plugin);
    await close(plugin);
    for (const adapter of Object.values(runtime)) expect(adapter).not.toHaveBeenCalled();
  });

  it('prechecks the port before spawning the published CLI with a private loopback group', async () => {
    const { plugin, runtime } = harness();
    await start(plugin);
    expect(plugin.apply).toBe('serve');
    expect(runtime.checkPortAvailable).toHaveBeenCalledWith(5320, '127.0.0.1');
    expect(vi.mocked(runtime.checkPortAvailable).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(runtime.spawn).mock.invocationCallOrder[0]!,
    );
    expect(runtime.resolveCli).toHaveBeenCalledWith(workspaceRoot);
    expect(runtime.spawn).toHaveBeenCalledWith(process.execPath,
      ['/published/nitropack/dist/cli/index.mjs', '--host', '127.0.0.1', '--port', '5320'],
      expect.objectContaining({ cwd: resolve(workspaceRoot, 'apps/backend-mock'), detached: true }),
    );
    expect(runtime.fetch).toHaveBeenCalledWith('http://127.0.0.1:5320/api/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await close(plugin);
  });

  it('honors an explicit port in preflight, process arguments, and readiness', async () => {
    const { runtime } = harness();
    const plugin = backendMockPlugin({ workspaceRoot, enabled: true, port: 5432 }, runtime);
    await start(plugin);
    expect(runtime.checkPortAvailable).toHaveBeenCalledWith(5432, '127.0.0.1');
    expect(vi.mocked(runtime.spawn).mock.calls[0]![1]).toContain('5432');
    expect(vi.mocked(runtime.fetch).mock.calls[0]![0]).toBe('http://127.0.0.1:5432/api/health');
    await close(plugin);
  });

  it('fails an occupied port without probing, spawning, or killing any service', async () => {
    const { plugin, runtime } = harness();
    vi.mocked(runtime.checkPortAvailable).mockRejectedValue(new Error('Port 5320 is unavailable'));
    await expect(start(plugin)).rejects.toThrow('5320');
    expect(runtime.spawn).not.toHaveBeenCalled();
    expect(runtime.fetch).not.toHaveBeenCalled();
    expect(runtime.kill).not.toHaveBeenCalled();
  });

  it('propagates a synchronous spawn failure without inventing ownership', async () => {
    const { plugin, runtime } = harness();
    vi.mocked(runtime.spawn).mockImplementation(() => { throw new Error('spawn denied'); });
    await expect(start(plugin)).rejects.toThrow('spawn denied');
    expect(runtime.kill).not.toHaveBeenCalled();
  });

  it('propagates a process error before readiness and cleans its own group', async () => {
    const { plugin, child, runtime } = harness();
    vi.mocked(runtime.fetch).mockReturnValue(new Promise(() => {}));
    const result = expect(start(plugin)).rejects.toThrow('spawn failed');
    await settle();
    child.emit('error', new Error('spawn failed'));
    await result;
    expect(runtime.kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
  });

  it('handles ENOENT with no pid without signaling any process', async () => {
    const { plugin, runtime, child } = harness();
    vi.mocked(runtime.spawn).mockImplementation(() => {
      queueMicrotask(() => child.emit('error', new Error('ENOENT')));
      return Object.assign(child, { pid: undefined }) as unknown as ChildProcess;
    });
    await expect(start(plugin)).rejects.toThrow('ENOENT');
    expect(runtime.kill).not.toHaveBeenCalled();
  });

  it('rejects an exit before health even if a descendant remains and waits for cleanup', async () => {
    const { plugin, child, runtime, keepAlive, finish } = harness();
    keepAlive();
    vi.mocked(runtime.fetch).mockReturnValue(new Promise(() => {}));
    let settled = false;
    const result = expect(start(plugin)).rejects.toThrow(/exited.*7/i).then(() => { settled = true; });
    await settle();
    child.emit('exit', 7, null);
    await settle();
    expect(runtime.kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
    expect(settled).toBe(false);
    finish();
    await vi.advanceTimersByTimeAsync(50);
    await result;
  });

  it('retries failed connections and unhealthy payloads until actual health is ready', async () => {
    const { plugin, runtime } = harness();
    vi.mocked(runtime.fetch)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1, data: { status: 'ok' }, message: 'no' })))
      .mockResolvedValueOnce(new Response('not json'))
      .mockResolvedValueOnce(healthy());
    let ready = false;
    const startup = start(plugin).then(() => { ready = true; });
    await settle();
    expect(ready).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    await startup;
    expect(runtime.fetch).toHaveBeenCalledTimes(5);
    await close(plugin);
  });

  it('bounds a hung health request, aborts it, and reaps its group on startup failure', async () => {
    const { plugin, runtime } = harness();
    vi.mocked(runtime.fetch).mockReturnValue(new Promise(() => {}));
    const result = expect(start(plugin)).rejects.toThrow(/timed out/i);
    await settle();
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(vi.mocked(runtime.fetch).mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(runtime.kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
  });

  it('awaits group disappearance on normal close and is idempotent', async () => {
    const { plugin, runtime, child, keepAlive, finish } = harness();
    await start(plugin);
    keepAlive();
    let closed = false;
    const closing = close(plugin).then(() => { closed = true; });
    await settle();
    child.emit('exit', 0, null);
    await settle();
    expect(closed).toBe(false);
    finish();
    await vi.advanceTimersByTimeAsync(50);
    await closing;
    await close(plugin);
    expect(runtime.kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
    expect(vi.mocked(runtime.kill).mock.calls.filter(([, signal]) => signal === 'SIGTERM')).toHaveLength(1);
  });

  it('escalates only its own group when Nitro children ignore SIGTERM', async () => {
    const { plugin, runtime, keepAlive, finish } = harness();
    await start(plugin);
    keepAlive();
    const closing = close(plugin);
    await settle();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runtime.kill).toHaveBeenCalledWith(-4242, 'SIGKILL');
    finish();
    await vi.advanceTimersByTimeAsync(50);
    await closing;
    expect(vi.mocked(runtime.kill).mock.calls.every(([pid]) => pid === -4242)).toBe(true);
  });

  it('closes during startup without allowing late preflight to spawn', async () => {
    const { plugin, runtime } = harness();
    let release!: () => void;
    vi.mocked(runtime.checkPortAvailable).mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    const startup = expect(start(plugin)).rejects.toThrow(/closed/i);
    await settle();
    const closing = close(plugin);
    release();
    await startup;
    await closing;
    expect(runtime.spawn).not.toHaveBeenCalled();
  });

  it('cleans up on restart before the new plugin instance starts', async () => {
    const first = harness();
    await start(first.plugin);
    await close(first.plugin);
    const second = harness();
    await start(second.plugin);
    expect(second.runtime.spawn).toHaveBeenCalledTimes(1);
    await close(second.plugin);
  });

  it('handles post-readiness process errors and exit without unhandled events', async () => {
    const { plugin, child, runtime } = harness();
    await start(plugin);
    child.emit('exit', 9, null);
    child.emit('error', new Error('late worker error'));
    expect(() => child.emit('error', new Error('another late error'))).not.toThrow();
    await close(plugin);
    expect(runtime.kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
    expect(child.listenerCount('error')).toBe(0);
    expect(child.listenerCount('exit')).toBe(0);
  });

  it('cancels pending health when Vite closes and waits for process cleanup', async () => {
    const { plugin, runtime } = harness();
    vi.mocked(runtime.fetch).mockReturnValue(new Promise(() => {}));
    const startup = expect(start(plugin)).rejects.toThrow(/closed/i);
    await settle();
    await close(plugin);
    await startup;
    expect(vi.mocked(runtime.fetch).mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(runtime.kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
  });

  it('reports cleanup failure rather than claiming a still-live group has stopped', async () => {
    const { plugin, keepAlive } = harness();
    await start(plugin);
    keepAlive();
    const closing = expect(close(plugin)).rejects.toThrow(/did not stop/i);
    await vi.advanceTimersByTimeAsync(4_000);
    await closing;
  });
});

it('does not accept even healthy HTTP before this child confirms the requested listen address', async () => {
  const { runtime, child } = harness(false);
  let settled = false;
  const owner = createBackendOwner({ workspaceRoot, enabled: true }, runtime);
  const started = owner.start().then(() => { settled = true; });
  await settle();
  expect(settled).toBe(false);
  expect(runtime.fetch).not.toHaveBeenCalled();
  child.emit('message', { type: 'mock:listening', host: '127.0.0.1', port: 5320 });
  await started;
  expect(runtime.fetch).toHaveBeenCalledOnce();
  await owner.close();
});

it('propagates an explicit child cleanup failure instead of reporting clean shutdown', async () => {
  const child = Object.assign(new EventEmitter(), {pid: 4242}); let alive = true;
  const runtime: BackendMockRuntime = {
    checkPortAvailable: async () => {}, resolveCli: () => '/fake/child.ts',
    spawn: () => { queueMicrotask(()=>child.emit('message',{type:'mock:listening',host:'127.0.0.1',port:5320}));return child as unknown as ChildProcess; },
    fetch: async () => healthy(),
    kill: (_pid, signal) => { if (!alive) throw Object.assign(new Error('gone'),{code:'ESRCH'});if(signal==='SIGTERM'){alive=false;child.emit('exit',1,null);}return true; },
  };
  const owner=createBackendOwner({workspaceRoot,enabled:true},runtime);await owner.start();
  await expect(owner.close()).rejects.toThrow(/cleanup|shutdown/i);
});
