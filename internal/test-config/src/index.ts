import { defineConfig } from 'vitest/config';
import type { ViteUserConfig as UserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { basename } from 'node:path';

export function createTestConfig(options: {
  root: string;
  environment: 'node' | 'jsdom';
  include: string[];
  setupFiles?: string[];
}): UserConfig {
  const ci = process.env.CI === 'true' || process.env.CI === '1';
  return defineConfig({
    root: options.root,
    plugins: options.environment === 'jsdom' ? [react()] : [],
    test: {
      name: basename(options.root),
      environment: options.environment,
      include: options.include,
      setupFiles: options.setupFiles,
      clearMocks: true,
      restoreMocks: true,
      // Keep local runs small while preserving the CI worker budget.
      maxWorkers: ci ? '50%' : 2,
    },
  });
}
