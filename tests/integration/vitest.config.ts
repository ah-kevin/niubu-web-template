import { fileURLToPath } from 'node:url';
import { createTestConfig } from '@niubu-internal/test-config';
export default createTestConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  environment: 'jsdom',
  include: ['**/*.{test,spec}.{ts,tsx}'],
  setupFiles: ['./setup.ts'],
});
