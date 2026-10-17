import { resolve } from 'node:path';
import { build, mergeConfig } from 'vite';
import { createWebViteConfig } from '@niubu-internal/vite-config';

let compiled: Promise<string> | undefined;

/** Compile the real app entry so consumers also exercise its explicit source scan. */
export function compilePlaygroundStyles(): Promise<string> {
  compiled ??= (async () => {
    const appRoot = resolve(import.meta.dirname, '../..');
    const workspaceRoot = resolve(import.meta.dirname, '../../../..');
    const result = await build(
      mergeConfig(createWebViteConfig({ appRoot, workspaceRoot }), {
        configFile: false,
        logLevel: 'silent',
        build: {
          write: false,
          manifest: false,
          minify: false,
          cssMinify: false,
          rollupOptions: { input: resolve(import.meta.dirname, '../styles/index.css') },
        },
      }),
    );
    if ('close' in result) throw new Error('Style verification requires a completed build');
    return (Array.isArray(result) ? result : [result])
      .flatMap(output => output.output)
      .flatMap(output =>
        output.type === 'asset' && output.fileName.endsWith('.css')
          ? [typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString()]
          : [],
      )
      .join('\n');
  })();
  return compiled;
}

export interface CompiledStyleRule {
  selector: string;
  style: CSSStyleDeclaration;
  layer: string | null;
  media: string[];
}

/** Inspect emitted CSS; this deliberately makes no browser layout claims. */
export function readCompiledRules(css: string): CompiledStyleRule[] {
  const sheet = document.createElement('style');
  sheet.textContent = css;
  document.head.append(sheet);
  const result: CompiledStyleRule[] = [];
  function visit(rules: CSSRuleList, layer: string | null = null, media: string[] = []) {
    for (const rule of Array.from(rules)) {
      if ('selectorText' in rule && 'style' in rule) {
        const declaration = rule as CSSStyleRule;
        result.push({ selector: declaration.selectorText, style: declaration.style, layer, media });
      } else if ('cssRules' in rule) {
        const group = rule as CSSGroupingRule;
        const nextLayer = rule.constructor.name === 'CSSLayerBlockRule' && 'name' in rule ? String(rule.name) : layer;
        const nextMedia =
          'conditionText' in rule && rule.constructor.name === 'CSSMediaRule'
            ? [...media, String(rule.conditionText)]
            : media;
        visit(group.cssRules, nextLayer, nextMedia);
      }
    }
  }
  try {
    if (!sheet.sheet) throw new Error('The built stylesheet did not parse');
    visit(sheet.sheet.cssRules);
    return result;
  } finally {
    sheet.remove();
  }
}

export function matchingRules(rules: CompiledStyleRule[], element: Element, property: string): CompiledStyleRule[] {
  return rules.filter(rule => {
    if (!rule.style.getPropertyValue(property)) return false;
    try {
      return element.matches(rule.selector);
    } catch {
      return false;
    }
  });
}
