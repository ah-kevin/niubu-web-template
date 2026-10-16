import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from 'vite';
import type { InlineConfig } from 'vite';
import type { BuildProvenanceApi } from '@niubu-internal/node-utils';

/** Finalize only after Vite has awaited every bundle write and close hook. */
export async function buildApp(options: InlineConfig = {}): Promise<void> {
  if (options.build?.watch) throw Error('Provenance requires a completed non-watch build');
  const finalizers: (() => void)[] = [];
  await build({
    ...options,
    plugins: [
      ...(options.plugins ?? []),
      {
        name: 'niubu:collect-build-finalizers',
        configResolved(config) {
          if (config.build.watch || !config.build.write) throw Error('Provenance requires final on-disk output');
          for (const plugin of config.plugins) {
            if (plugin.name === 'niubu:build-provenance') {
              const api = plugin.api as BuildProvenanceApi | undefined;
              if (typeof api?.finalize !== 'function') throw Error('Build provenance finalizer is missing');
              finalizers.push(api.finalize);
            }
          }
          if (finalizers.length !== 1) throw Error('Exactly one build provenance plugin is required');
        },
      },
    ],
  });
  finalizers.forEach(finalize => finalize());
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // pnpm run forwards its optional separator into the script's argv.
  const args = process.argv.slice(2);
  if (args[0] === '--') args.shift();
  const { values, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      mode: { type: 'string', short: 'm' },
      base: { type: 'string' },
      config: { type: 'string', short: 'c' },
    },
  });
  if (positionals.length > 1) throw Error('Build accepts at most one positional root argument');
  await buildApp({ root: positionals[0], mode: values.mode, base: values.base, configFile: values.config });
}
