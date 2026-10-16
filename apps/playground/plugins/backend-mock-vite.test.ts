// @vitest-environment node
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { Server } from 'node:net';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import backendMockPlugin, { type BackendMockRuntime } from './backend-mock';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const servers: ViteDevServer[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close().catch(() => {});
  vi.restoreAllMocks();
});
function harness() {
  const groups = new Map<number, EventEmitter>();
  let nextPid = 4242;
  let denied = false;
  const events: string[] = [];
  const runtime: BackendMockRuntime = {
    checkPortAvailable: vi.fn().mockResolvedValue(undefined),
    resolveCli: () => '/fake/nitro-cli.mjs',
    spawn: vi.fn(() => {
      const child = Object.assign(new EventEmitter(), { pid: nextPid++ });
      groups.set(child.pid, child); events.push(`start:${child.pid}`);
      return child as unknown as ChildProcess;
    }),
    fetch: async () => new Response(JSON.stringify({code:0,data:{status:'ok'},message:'OK'})),
    kill: vi.fn((pid, signal) => {
      const child = groups.get(-pid);
      if (!child) throw Object.assign(new Error('No process'), {code:'ESRCH'});
      if (signal !== 0) {
        if (denied) throw Object.assign(new Error('Owned group shutdown denied'), {code:'EPERM'});
        groups.delete(-pid); events.push(`stop:${-pid}`); child.emit('exit',0,signal);
      }
      return true;
    }),
  };
  return {runtime,groups,events,deny:()=>{denied=true;},permit:()=>{denied=false;}};
}
function virtualSockets(occupied=false) {
  vi.spyOn(Server.prototype,'listen').mockImplementation(function (this: Server) {
    queueMicrotask(()=>this.emit(occupied?'error':'listening', occupied?Object.assign(new Error('occupied'),{code:'EADDRINUSE'}):undefined));
    return this;
  });
  vi.spyOn(Server.prototype,'address').mockReturnValue({address:'127.0.0.1',family:'IPv4',port:5174});
  vi.spyOn(Server.prototype,'close').mockImplementation(function (this: Server, callback?: (error?: Error)=>void) {
    queueMicrotask(()=>callback?.()); return this;
  });
}
async function serverFor(runtime: BackendMockRuntime) {
  const server = await createServer({configFile:false,root:workspaceRoot,logLevel:'silent',plugins:[backendMockPlugin({workspaceRoot,enabled:true},runtime)],server:{host:'127.0.0.1',port:5174,strictPort:true,watch:null,hmr:false},optimizeDeps:{noDiscovery:true,include:[]}});
  servers.push(server); return server;
}
it('real Vite listen failure leaves no owned mock group or sockets', async () => {
  virtualSockets(true); const h=harness(); const server=await serverFor(h.runtime);
  await expect(server.listen()).rejects.toThrow(/already in use|occupied/i);
  expect(h.groups.size).toBe(0);
});
it('real Vite close propagates an owned mock cleanup error instead of swallowing it', async () => {
  virtualSockets(); const h=harness(); const server=await serverFor(h.runtime); await server.listen();
  h.deny(); await expect(server.close()).rejects.toThrow(/shutdown denied|cleanup/i);
  h.permit();
  // Test adapters own no real PID. Clear the synthetic group after the expected rejection.
  h.groups.clear();
});
it('real Vite restart closes its previous owner before starting exactly one new owner', async () => {
  virtualSockets(); const h=harness(); const server=await serverFor(h.runtime); await server.listen();
  await server.restart();
  expect(h.events).toEqual(['start:4242','stop:4242','start:4243']);
  expect(h.groups.size).toBe(1);
  await server.close(); expect(h.groups.size).toBe(0);
});
