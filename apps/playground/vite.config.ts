import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { createWebViteConfig } from '@niubu-internal/vite-config';
import { appIdentity } from './src/app/config.ts';
import { runtimeConfigDescriptor } from './src/runtime-config.ts';
function mockOrigin(value = 'http://127.0.0.1:5320') {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error('MOCK_API_URL must be an HTTP(S) origin');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw Error('MOCK_API_URL must be an HTTP(S) origin');
  return url.origin;
}

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
export default mergeConfig(
  createWebViteConfig({
    appRoot,
    workspaceRoot,
    runtimeConfig: runtimeConfigDescriptor,
    themeInit: {
      entry: 'src/theme-init.ts',
      appId: appIdentity.appId,
      environment: appIdentity.environment,
      globalName: 'PlaygroundThemeInit',
    },
    firstScreen: {
      appName: '@niubu/playground',
      modules: {
        home: 'src/modules/home.tsx',
        demo: 'src/modules/demo.tsx',
        commonZh: '../../packages/locales/src/resources/zh-CN/common.json',
        validationZh: '../../packages/locales/src/resources/zh-CN/validation.json',
        shellZh: '../../packages/locales/src/resources/zh-CN/shell.json',
        appZh: 'src/locales/zh-CN/app.json',
        themeInit: 'src/theme-init.ts',
      },
      variants: {
        'zh-CN-startup': {},
        'en-US-startup': {
          commonEn: '../../packages/locales/src/resources/en-US/common.json',
          validationEn: '../../packages/locales/src/resources/en-US/validation.json',
          shellEn: '../../packages/locales/src/resources/en-US/shell.json',
          appEn: 'src/locales/en-US/app.json',
        },
        'en-US-failure-zh-CN-fallback': {
          commonEn: '../../packages/locales/src/resources/en-US/common.json',
          validationEn: '../../packages/locales/src/resources/en-US/validation.json',
          shellEn: '../../packages/locales/src/resources/en-US/shell.json',
          appEn: 'src/locales/en-US/app.json',
        },
      },
    },
  }),
  {
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      proxy: { '/api': { target: mockOrigin(process.env.MOCK_API_URL), changeOrigin: false } },
    },
    preview: { host: '127.0.0.1', port: 5174, strictPort: true },
  },
);
