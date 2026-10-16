import './scripts/tokens.ts';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
for (const target of Object.values(manifest.exports)) {
  const file = fileURLToPath(new URL(target, import.meta.url));
  if (!file.endsWith('.css') || !statSync(file).isFile() || !readFileSync(file, 'utf8').trim()) throw new Error(`Invalid CSS export: ${target}`);
}
for (const name of Object.keys(manifest.dependencies)) {
  const packageRoot = new URL(`./node_modules/${name}/`, import.meta.url);
  const dependency = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'));
  const target = dependency.exports?.['.']?.style;
  if (typeof target !== 'string' || !statSync(new URL(target, packageRoot)).isFile()) {
    throw new Error(`Invalid CSS dependency export: ${name}`);
  }
}
console.log('Source CSS exports and dependency resolution passed.');
