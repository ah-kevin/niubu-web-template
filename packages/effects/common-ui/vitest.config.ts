import { fileURLToPath } from 'node:url';
import { createTestConfig } from '@niubu-internal/test-config';
import manifest from './package.json' with { type: 'json' };

export default createTestConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  environment: 'jsdom',
  include: manifest.niubu.test.include,
  setupFiles: ['./src/tests/setup.ts'],
});
