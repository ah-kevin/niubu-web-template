import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { buildProvenance } from './build-provenance.ts';
import type { FirstScreenOptions } from './build-provenance.ts';
import { themeInitPlugin, type ThemeInitOptions } from './theme-init-plugin.ts';
import { runtimeConfigPlugin } from './runtime-config-plugin.ts';
import type { RuntimeConfigDescriptor } from '@niubu-internal/node-utils';

export type { FirstScreenOptions } from './build-provenance.ts';
export { themeInitPlugin } from './theme-init-plugin.ts';
export type { ThemeInitOptions } from './theme-init-plugin.ts';
export { runtimeConfigPlugin } from './runtime-config-plugin.ts';
export type { RuntimeConfigDescriptor } from '@niubu-internal/node-utils';

export function createWebViteConfig(options: {
  appRoot: string;
  workspaceRoot: string;
  firstScreen?: FirstScreenOptions;
  themeInit?: ThemeInitOptions;
  runtimeConfig?: RuntimeConfigDescriptor;
}): UserConfig {
  return defineConfig({
    root: options.appRoot,
    plugins: [
      react(),
      tailwindcss(),
      ...(options.firstScreen ? [buildProvenance({ ...options, firstScreen: options.firstScreen })] : []),
      // Both are post plugins: capture canonical inputs before the separate IIFE build.
      ...(options.themeInit ? [themeInitPlugin(options.themeInit)] : []),
      ...(options.runtimeConfig ? [runtimeConfigPlugin(options.runtimeConfig)] : []),
    ],
    resolve: { alias: { '@': resolve(options.appRoot, 'src') }, dedupe: ['react', 'react-dom', 'react-is'] },
    server: { fs: { allow: [options.workspaceRoot] } },
    build: { manifest: true },
  });
}
