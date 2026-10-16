import { readFileSync, writeFileSync, renameSync, rmSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  RuntimeConfigError,
  parseRuntimeConfigScript,
  serializeRuntimeConfig,
  validateRuntimeConfig,
} from './runtime-config-contract.mjs';
function argument(name, fallback) {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
}
try {
  const root = realpathSync(argument('--root', '/usr/share/nginx/html'));
  const metadata = JSON.parse(readFileSync(argument('--metadata', '/opt/template/deployment.json'), 'utf8'));
  if (!metadata || metadata.schemaVersion !== 1 || metadata.runtimeConfig !== '_app.config.js')
    throw new Error('Invalid deployment metadata');
  const target = resolve(root, metadata.runtimeConfig),
    path = relative(root, target);
  if (!path || path.startsWith('..') || isAbsolute(path) || lstatSync(target).isSymbolicLink())
    throw new Error('Invalid runtime configuration target');
  const original = readFileSync(target, 'utf8'),
    current = parseRuntimeConfigScript(original),
    apiURL = process.env.APP_API_URL;
  const next = serializeRuntimeConfig(
    apiURL === undefined ? current : validateRuntimeConfig({ schemaVersion: 1, apiURL }),
  );
  if (next !== original) {
    const temporary = join(dirname(target), '.runtime-config-' + randomUUID() + '.tmp');
    try {
      writeFileSync(temporary, next, { flag: 'wx', mode: 0o644 });
      renameSync(temporary, target);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
} catch (error) {
  console.error(error instanceof RuntimeConfigError ? error.message : 'RUNTIME_CONFIG_INJECTION_FAILED');
  process.exitCode = 1;
}
