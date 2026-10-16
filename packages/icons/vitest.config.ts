import { fileURLToPath } from 'node:url';
import { createTestConfig } from '@niubu-internal/test-config';
export default createTestConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  environment: 'node',
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
});
