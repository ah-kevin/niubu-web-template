import { createRequire } from 'node:module';
import { Server } from 'node:net';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { strictListenOptions } from '../dev-server';
const backendRequire = createRequire(import.meta.url);
const nitroRequire = createRequire(backendRequire.resolve('nitropack/package.json'));
const { listen } = await import(pathToFileURL(nitroRequire.resolve('listhen')).href);
afterEach(() => vi.restoreAllMocks());
it('actual Nitro listener dependency rejects an occupied requested port without fallback', async () => {
  const attempts: number[] = [];
  const addresses = new WeakMap<Server, {port: number; family: string; address: string}>();
  vi.spyOn(Server.prototype, 'listen').mockImplementation(function(this: Server, ...args: unknown[]) {
    const port = Number(typeof args[0] === 'object' && args[0] !== null ? (args[0] as {port: number}).port : args[0]);
    attempts.push(port);
    const callback = args.at(-1); if (typeof callback === 'function') this.once('listening', callback as () => void);
    queueMicrotask(() => {
      if (port === 5320) this.emit('error', Object.assign(new Error('competitor took requested port'), {code:'EADDRINUSE'}));
      else { addresses.set(this,{port,family:'IPv4',address:'127.0.0.1'});this.emit('listening'); }
    });return this;
  } as never);
  vi.spyOn(Server.prototype,'address').mockImplementation(function(this: Server) { return addresses.get(this) ?? null; });
  vi.spyOn(Server.prototype,'close').mockImplementation(function(this: Server, callback?: (error?: Error)=>void) { queueMicrotask(()=>callback?.());return this; });
  let listener: { close(): Promise<void> } | undefined;
  let error: unknown;
  try { listener = await listen(()=>{}, strictListenOptions('127.0.0.1',5320)); }
  catch(cause) { error = cause; }
  finally { await listener?.close(); }
  expect(error, 'occupied requested port must fail rather than selecting a fallback').toBeInstanceOf(Error);
  expect(attempts).toEqual([5320]);
});
