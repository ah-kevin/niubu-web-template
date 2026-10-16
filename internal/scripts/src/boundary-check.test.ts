import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkBoundary, readBoundaryConfig, type BoundaryConfig } from './boundary-check';

let root: string;
const config: BoundaryConfig = {
  scan: ['packages'],
  exclude: ['node_modules', '.turbo', 'dist', 'coverage'],
  words: ['widget'],
  literals: ['中文词', 'BrandX'],
  allow: [],
};
const put = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'boundary-fixture-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('repository text boundaries', () => {
  it('flags literal substrings with one-based line numbers and exact case', () => {
    put('packages/a/src/x.ts', 'ok\nconst t = "前中文词后";\r\nBrandX brandx');
    expect(checkBoundary(root, config).errors).toEqual([
      'packages/a/src/x.ts:2: forbidden term "中文词"',
      'packages/a/src/x.ts:3: forbidden term "BrandX"',
    ]);
  });
  it.each([
    ['widget', 'widget'],
    ['widgetPanel', 'widget'],
    ['Widget', 'Widget'],
    ['myWidgetId', 'Widget'],
    ['WIDGET_KEY', 'WIDGET'],
    ['myWIDGET', 'WIDGET'],
    ['_widget', 'widget'],
  ])('flags the word form %s', (text, term) => {
    put('packages/a/x.ts', text);
    expect(checkBoundary(root, config).errors).toEqual([`packages/a/x.ts:1: forbidden term "${term}"`]);
  });
  it.each(['widgetry', 'subwidget', 'Widgetry', 'SUBWIDGET', 'WIDGETS', 'XWidget', 'WIDGETry'])(
    'does not flag a mere letter sequence in %s',
    text => {
      put('packages/a/x.ts', text);
      expect(checkBoundary(root, config).errors).toEqual([]);
    },
  );
  it('reports every occurrence on the same line', () => {
    put('packages/a/x.ts', 'widgetPanel; myWidgetId; WIDGET_KEY; 中文词 中文词');
    expect(checkBoundary(root, config).errors).toHaveLength(5);
  });
  it('skips excluded directories at any depth and paths outside scan roots', () => {
    for (const directory of config.exclude) put(`packages/a/${directory}/nested/x.ts`, '中文词');
    put('apps/playground/src/x.ts', '中文词');
    expect(checkBoundary(root, config).errors).toEqual([]);
  });
  it('scans only supported text extensions', () => {
    const extensions = ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json', 'css', 'md', 'html', 'yaml', 'yml'];
    for (const extension of [...extensions, 'svg', 'png', 'lock']) put(`packages/x.${extension}`, '中文词');
    expect(checkBoundary(root, config).errors).toHaveLength(extensions.length);
  });
  it('honors only exact paths and matched text and reports stale entries', () => {
    put('packages/icons/src/index.ts', 'export { Widget } from "x";');
    put('packages/other.ts', 'Widget widget');
    const allow = [
      { path: 'packages/icons/src/index.ts', term: 'Widget', reason: 'icon name' },
      { path: 'packages/other.ts', term: 'WIDGET', reason: 'different case' },
      { path: 'packages/gone.ts', term: 'Widget', reason: 'removed file' },
    ];
    expect(checkBoundary(root, { ...config, allow }).errors).toEqual([
      'packages/other.ts:1: forbidden term "Widget"',
      'packages/other.ts:1: forbidden term "widget"',
      'boundary allow entry no longer matches: packages/other.ts "WIDGET"',
      'boundary allow entry no longer matches: packages/gone.ts "Widget"',
    ]);
  });
  it('reports an allow entry as stale when its file remains but its match was removed', () => {
    put('packages/x.ts', 'export {};');
    expect(
      checkBoundary(root, { ...config, allow: [{ path: 'packages/x.ts', term: 'Widget', reason: 'removed text' }] })
        .errors,
    ).toEqual(['boundary allow entry no longer matches: packages/x.ts "Widget"']);
  });
  it('accepts missing scan directories', () => {
    expect(checkBoundary(root, config).errors).toEqual([]);
  });
  it('reads a valid repository config', () => {
    put('boundary.config.json', JSON.stringify(config));
    expect(readBoundaryConfig(root)).toEqual(config);
  });
  it.each([
    null,
    [],
    { scan: 'packages' },
    { ...config, exclude: [0] },
    { ...config, words: [''] },
    { ...config, literals: [false] },
    { ...config, allow: [{}] },
    { ...config, allow: [{ path: 'packages/x.ts', term: 'Widget', reason: '' }] },
  ])('rejects a malformed config file: %j', value => {
    put('boundary.config.json', JSON.stringify(value));
    expect(() => readBoundaryConfig(root)).toThrow();
  });
});
