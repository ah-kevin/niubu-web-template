import { resolveRuntimeConfig, type RuntimeConfigDescriptor } from '@niubu/utils/runtime-config';

export const runtimeConfigDescriptor = Object.freeze({
  fileName: '_app.config.js',
  schemaVersion: 1,
  defaults: Object.freeze({ schemaVersion: 1, apiURL: '/' }),
}) satisfies RuntimeConfigDescriptor;
export function readRuntimeConfig(options: { runtimeConfig?: unknown }, origin: string) {
  const value = Object.hasOwn(options, 'runtimeConfig')
    ? options.runtimeConfig
    : (globalThis as typeof globalThis & { __APP_RUNTIME_CONFIG__?: unknown }).__APP_RUNTIME_CONFIG__;
  return resolveRuntimeConfig(value, origin);
}
