import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'tests/integration/vitest.config.ts',
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
      'packages/@core/base/*/vitest.config.ts',
      'packages/@core/ui-kit/*/vitest.config.ts',
      'packages/effects/*/vitest.config.ts',
      'internal/*/vitest.config.ts',
      'internal/lint-configs/*/vitest.config.ts',
    ],
  },
});
