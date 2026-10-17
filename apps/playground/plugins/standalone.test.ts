// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { resolveConfig } from 'vite';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
afterEach(() => vi.unstubAllEnvs());
it('serves the app without installing a backend process starter', async () => {
  const config = await resolveConfig({ root, configFile: resolve(root, 'vite.config.ts') }, 'serve');
  expect(config.plugins.map(plugin => plugin.name)).not.toContain('niubu:backend-mock');
  expect(config.server.proxy?.['/api']).toMatchObject({ target: 'http://127.0.0.1:5320' });
});
it('connects to an independently configured backend origin', async () => {
  vi.stubEnv('MOCK_API_URL', 'http://127.0.0.1:5432');
  const config = await resolveConfig({ root, configFile: resolve(root, 'vite.config.ts') }, 'serve');
  expect(config.server.proxy?.['/api']).toMatchObject({ target: 'http://127.0.0.1:5432' });
});
it.each(['javascript:alert(1)', 'http://u:p@127.0.0.1:5320', 'http://127.0.0.1:5320/api', 'http://127.0.0.1:5320?key=1'])('rejects invalid proxy target %s', async target => {
  vi.stubEnv('MOCK_API_URL', target);
  await expect(resolveConfig({ root, configFile: resolve(root, 'vite.config.ts') }, 'serve')).rejects.toThrow(/origin/i);
});
