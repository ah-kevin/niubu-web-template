import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, type Plugin, type ResolvedConfig } from 'vite';
import { sha256, type BuildProvenanceApi, type ThemeInitIifeEvidence } from '@niubu-internal/node-utils';

export interface ThemeInitOptions {
  entry: string;
  appId: string;
  environment: string;
  globalName: string;
}

/** Validate actual text order, including any final HTML mutation by another hook. */
export function assertThemeInitHead(html: string, src: string) {
  const tags = [...html.matchAll(/<(script|link|style)\b([^>]*)>/gi)].map(match => ({
    name: match[1].toLowerCase(),
    index: match.index!,
    attributes: Object.fromEntries(
      [...match[2].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=]+)))?/g)].map(attr => [
        attr[1].toLowerCase(),
        attr[2] ?? attr[3] ?? attr[4] ?? '',
      ]),
    ),
  }));
  const classic = tags.filter(tag => tag.name === 'script' && tag.attributes.src === src);
  if (classic.length !== 1) throw Error('Exactly one theme-init classic script is required');
  const tag = classic[0];
  if (['type', 'async', 'defer'].some(key => Object.hasOwn(tag.attributes, key)))
    throw Error('Theme-init script must be a blocking classic script');
  const head = html.match(/<head\b[^>]*>/i),
    end = html.search(/<\/head\s*>/i);
  if (!head || tag.index < head.index! + head[0].length || tag.index > end)
    throw Error('Theme-init script must be in head');
  for (const other of tags) {
    if (
      other.name === 'style' ||
      (other.name === 'script' && other.attributes.type?.toLowerCase() === 'module') ||
      (other.name === 'link' && other.attributes.rel?.toLowerCase().split(/\s+/).includes('stylesheet'))
    )
      if (other.index < tag.index)
        throw Error('Theme-init classic script must precede all stylesheets and app modules');
  }
}

export function themeInitPlugin(options: ThemeInitOptions): Plugin {
  if (!options.appId || !options.environment) throw Error('Theme-init app identity is required');
  let config: ResolvedConfig;
  let entry: string;
  let fileName: string | undefined;
  async function compile(): Promise<ThemeInitIifeEvidence> {
    const result = await build({
      configFile: false,
      root: config.root,
      base: config.base,
      mode: config.mode,
      envDir: config.envDir,
      envPrefix: config.envPrefix,
      resolve: config.resolve,
      define: { ...config.define, 'import.meta.env': JSON.stringify(config.env) },
      logLevel: 'silent',
      plugins: [],
      publicDir: false,
      build: {
        write: false,
        emptyOutDir: false,
        manifest: false,
        target: config.build.target,
        minify: config.build.minify,
        lib: { entry, name: options.globalName, formats: ['iife'], fileName: 'theme-init' },
      },
    });
    if (Array.isArray(result)) {
      if (result.length !== 1) throw Error('Theme-init must produce one output');
    }
    const built = Array.isArray(result) ? result[0] : result;
    if (!('output' in built)) throw Error('Theme-init requires a completed non-watch build');
    const output = built.output;
    if (output.length !== 1 || output[0].type !== 'chunk')
      throw Error('Theme-init must produce a single JavaScript IIFE');
    const chunk = output[0];
    if (chunk.imports.length || chunk.dynamicImports.length) throw Error('Theme-init must be self-contained');
    return {
      entry,
      fileName: `assets/theme-init-${sha256(chunk.code).slice(0, 12)}.js`,
      chunk: {
        code: chunk.code,
        facadeModuleId: chunk.facadeModuleId,
        moduleIds: Object.keys(chunk.modules),
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
        isEntry: chunk.isEntry,
      },
    };
  }
  const devPath = () =>
    `${config.base}@niubu/theme-init/${encodeURIComponent(options.appId)}/${encodeURIComponent(options.environment)}.js`;
  return {
    name: 'niubu:theme-init',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
      const file = resolve(config.root, options.entry);
      if (!existsSync(file)) throw Error(`Theme-init entry is missing: ${file}`);
      entry = realpathSync(file);
    },
    async buildStart() {
      if (config.command !== 'build') return;
      const evidence = await compile();
      fileName = evidence.fileName;
      this.emitFile({ type: 'asset', fileName, source: evidence.chunk.code });
      const provenance = config.plugins.find(plugin => plugin.name === 'niubu:build-provenance')?.api as
        BuildProvenanceApi | undefined;
      provenance?.registerThemeInitIife(evidence);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== devPath()) return next();
        try {
          const evidence = await compile();
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(evidence.chunk.code);
        } catch (error) {
          next(error);
        }
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (config.command === 'build' && !fileName) throw Error('Theme-init IIFE is not emitted');
        const src = config.command === 'build' ? `${config.base}${fileName}` : devPath();
        const result = html.replace(/<head\b[^>]*>/i, head => `${head}\n    <script src="${src}"></script>`);
        assertThemeInitHead(result, src);
        return result;
      },
    },
  };
}
