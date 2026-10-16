import { validateRuntimeConfig, type RuntimeConfigDescriptor } from '@niubu/core-shared/runtime-config';

/** Copy source policy once; callbacks, accessors and artifact-supplied fields cannot become policy. */
export function freezeRuntimeConfigDescriptor(value: RuntimeConfigDescriptor): RuntimeConfigDescriptor {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype)
    throw Error('Invalid source runtime configuration descriptor');
  const fields = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(fields).sort().join(',') !== 'defaults,fileName,schemaVersion' ||
    Object.values(fields).some(field => !('value' in field)) ||
    fields.fileName.value !== '_app.config.js' ||
    fields.schemaVersion.value !== 1
  )
    throw Error('Invalid source runtime configuration descriptor');
  return Object.freeze({
    fileName: '_app.config.js',
    schemaVersion: 1,
    defaults: validateRuntimeConfig(fields.defaults.value),
  });
}

/** Check raw HTML before initialHtml deduplicates roots. The source policy fixes the sole URL. */
export function assertRuntimeConfigHead(html: string, src: string, themeSrc?: string): void {
  const text = html.replace(/<!--[\s\S]*?-->/g, '');
  const tags = [...text.matchAll(/<(script|link|style)\b([^>]*)>/gi)].map(match => {
    const fields = [...match[2].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=]+)))?/g)];
    const keys = fields.map(field => field[1].toLowerCase());
    if (new Set(keys).size !== keys.length) throw Error('Duplicate HTML resource attribute');
    return {
      name: match[1].toLowerCase(),
      index: match.index!,
      attributes: Object.fromEntries(
        fields.map(field => [field[1].toLowerCase(), field[2] ?? field[3] ?? field[4] ?? '']),
      ),
    };
  });
  const candidates = tags.filter(tag => tag.name === 'script' && tag.attributes.src?.includes('_app.config.js'));
  if (candidates.length !== 1 || candidates[0].attributes.src !== src)
    throw Error('Exactly one runtime configuration script at the trusted URL is required');
  const tag = candidates[0];
  if (['type', 'async', 'defer', 'nomodule'].some(key => Object.hasOwn(tag.attributes, key)))
    throw Error('Runtime configuration script must be a blocking classic script');
  const head = text.match(/<head\b[^>]*>/i),
    end = text.search(/<\/head\s*>/i);
  if (!head || tag.index < head.index! + head[0].length || tag.index > end)
    throw Error('Runtime configuration script must be in head');
  const scripts = tags.filter(other => other.name === 'script');
  const theme = themeSrc && scripts.find(other => other.attributes.src === themeSrc);
  if (themeSrc && (!theme || scripts[0] !== theme || scripts[1] !== tag))
    throw Error('Theme classic script must be first, immediately before runtime configuration');
  if (!themeSrc && scripts[0] !== tag) throw Error('Runtime configuration must precede app scripts');
  for (const other of tags)
    if (
      other.index < tag.index &&
      (other.name === 'style' ||
        (other.name === 'script' && other.attributes.type?.toLowerCase() === 'module') ||
        (other.name === 'link' && other.attributes.rel?.toLowerCase().split(/\s+/).includes('stylesheet')))
    )
      throw Error('Runtime configuration must precede all stylesheets and app modules');
}
