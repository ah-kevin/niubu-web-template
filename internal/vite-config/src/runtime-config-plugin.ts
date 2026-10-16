import type { Plugin, ResolvedConfig } from 'vite';
import {
  assertRuntimeConfigHead,
  freezeRuntimeConfigDescriptor,
  serializeRuntimeConfig,
} from '@niubu-internal/node-utils';
import type { RuntimeConfigDescriptor } from '@niubu-internal/node-utils';

export function runtimeConfigPlugin(descriptor: RuntimeConfigDescriptor): Plugin {
  const policy = freezeRuntimeConfigDescriptor(descriptor);
  const source = serializeRuntimeConfig(policy.defaults);
  let config: ResolvedConfig;
  const src = () => `${config.base}${policy.fileName}`;
  return {
    name: 'niubu:runtime-config',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      if (config.command === 'build') this.emitFile({ type: 'asset', fileName: policy.fileName, source });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== src()) return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(source);
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Theme's post hook has already inserted its blocking script. Keep it first.
        const head = /<head\b[^>]*>/i.exec(html);
        if (!head) throw Error('Runtime configuration requires an HTML head');
        const first = /<script\b[^>]*>[\s\S]*?<\/script\s*>/i.exec(html.slice(head.index + head[0].length));
        const hasTheme = config.plugins.some(plugin => plugin.name === 'niubu:theme-init');
        if (hasTheme && !first) throw Error('Theme script must be injected before runtime configuration');
        const index = head.index + head[0].length + (hasTheme ? first!.index + first![0].length : 0);
        const result = html.slice(0, index) + `\n    <script src="${src()}"></script>` + html.slice(index);
        const themeSrc = hasTheme ? /\bsrc="([^"]+)"/i.exec(first![0])?.[1] : undefined;
        assertRuntimeConfigHead(result, src(), themeSrc);
        return result;
      },
    },
  };
}
