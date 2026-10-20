import { extname } from 'node:path';

export const sourcePublicScope = '@niubu';
export const productAppPath = ['apps', 'web'].join('/');
const starterPath = 'apps/starter';
const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.json',
  '.yaml',
  '.yml',
  '.css',
  '.md',
  '.html',
  '.svg',
  '.sh',
  '.txt',
]);
export type ProductIdentity = Readonly<{
  productSlug: string;
  displayNameZh: string;
  displayNameEn: string;
  packageName: string;
  defaultLocale: 'zh-CN' | 'en-US';
  publicScope: string;
}>;
export function outputPath(path: string): string {
  return path.startsWith(starterPath + '/') ? productAppPath + path.slice(starterPath.length) : path;
}
const string = (value: string) => JSON.stringify(value);
export function productConfig(identity: ProductIdentity): string {
  const scope = identity.publicScope;
  return `import type { CorePreferences, DeepPartial } from '${scope}/core-preferences';
import type { PreferenceIdentity } from '${scope}/preferences/pure';
export const appIdentity: PreferenceIdentity = Object.freeze({
  storageNamespace: ${string(identity.productSlug)}, product: ${string(identity.productSlug)},
  appId: ${string(identity.productSlug + '-web')}, environment: 'local', identityKey: 'anonymous',
});
export const appDefaults: DeepPartial<CorePreferences> = Object.freeze({
  locale: ${string(identity.defaultLocale)}, theme: Object.freeze({ mode: 'system' }),
  tabbar: Object.freeze({ enabled: true }), copyright: Object.freeze({ companyName: ${string(identity.displayNameEn)} }),
});
export const appPolicy: DeepPartial<CorePreferences> = Object.freeze({});
export const appConfig = Object.freeze({ appId: appIdentity.appId, displayName: ${string(identity.defaultLocale === 'zh-CN' ? identity.displayNameZh : identity.displayNameEn)}, homeHref: '/home', mode: 'backend' as const });
`;
}

/** Transform registered source families, never arbitrary user trees or generated binaries. */
export function transformProductFile(
  path: string,
  input: Buffer,
  identity: ProductIdentity,
  sourceName: string,
): Buffer {
  if (!textExtensions.has(extname(path)) && path !== 'Dockerfile' && !path.endsWith('ignore') && path !== 'CLAUDE.md')
    return input;
  let text = input.toString('utf8');
  if (!Buffer.from(text).equals(input)) throw new Error(`Unsupported text encoding: ${path}`);
  const productWiring = !path.startsWith('internal/');
  if (productWiring) {
    text = text.replaceAll(sourcePublicScope + '/starter', sourcePublicScope + '/web');
    text = text.replaceAll(starterPath, productAppPath);
  }
  if (
    path.startsWith(starterPath + '/') ||
    path === 'apps/backend-mock/src/profiles.ts' ||
    path === 'apps/backend-mock/src/profiles.test.ts' ||
    path === 'tests/integration/starter-startup.test.tsx'
  ) {
    text = text.replaceAll('template-starter', identity.productSlug + '-web');
    text = text.replaceAll('starter', identity.productSlug);
  }
  if (productWiring) {
    text = text.replaceAll(starterPath, productAppPath);
    text = text.replaceAll(sourcePublicScope + '/starter', sourcePublicScope + '/web');
  }
  if (identity.publicScope !== sourcePublicScope) {
    // Include escaped package separators inside assertion patterns, not the internal tool scope.
    text = text.replaceAll(sourcePublicScope + '\\/', identity.publicScope + '\\/');
    text = text.replaceAll(sourcePublicScope + '/', identity.publicScope + '/');
    for (const quote of ["'", '"', '`'])
      text = text.replaceAll(quote + sourcePublicScope + quote, quote + identity.publicScope + quote);
  }
  if (path === 'package.json') {
    const manifest = JSON.parse(text);
    manifest.name = identity.packageName;
    if (manifest.niubu) delete manifest.niubu.starterTemplateVersion;
    delete manifest.scripts?.['dev:starter'];
    if (manifest.scripts) manifest.scripts['dev:web'] = `pnpm --filter ${identity.publicScope}/web dev`;
    return Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  }
  if (path === starterPath + '/src/app/config.ts') return Buffer.from(productConfig(identity));
  if (path.startsWith(starterPath + '/src/locales/') && path.endsWith('/app.json')) {
    const catalog = JSON.parse(text);
    catalog.productName = path.includes('/zh-CN/') ? identity.displayNameZh : identity.displayNameEn;
    return Buffer.from(JSON.stringify(catalog, null, 2) + '\n');
  }
  if (path === starterPath + '/index.html') {
    const displayName = identity.defaultLocale === 'zh-CN' ? identity.displayNameZh : identity.displayNameEn;
    const escaped = displayName
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
    text = text
      .replace(/<title>[^<]*<\/title>/, `<title>${escaped}</title>`)
      .replace('lang="zh-CN"', `lang="${identity.defaultLocale}"`);
  }
  if (path === 'apps/backend-mock/mock.config.ts')
    text = `import { selectMockConfig } from './src/profiles';\nexport default selectMockConfig('${identity.productSlug}');\n`;
  if (path === 'turbo.json') {
    const config = JSON.parse(text);
    if (config.tasks[identity.publicScope + '/playground#build'] && !config.tasks[identity.publicScope + '/web#build'])
      throw new Error('Missing product build cache contract');
  }
  if (path === 'Dockerfile')
    text = text.replace(
      'APP_NAME=' + identity.publicScope + '/playground',
      'APP_NAME=' + identity.publicScope + '/web',
    );
  if (path === 'tests/integration/template-boundary.test.ts') {
    text = text.replace(`toBe('${sourceName}')`, `toBe('${identity.packageName}')`);
    text = text.replace(
      `key.startsWith('${identity.publicScope}/web#'))).toBe(false)`,
      `key.startsWith('${identity.publicScope}/web#'))).toBe(true)`,
    );
  }
  if (path === 'AGENTS.md') {
    text = text.replace(
      '本仓库是 Web 模板仓库：',
      '本仓库是生成的产品仓库，产品前端是 `apps' + '/web`，Playground 是开发参考：',
    );
  }
  if (path === 'README.md' || path === 'docs/guide/product-start.md') {
    text = `# ${identity.displayNameEn}\n\n${identity.displayNameZh} 管理后台。产品前端位于 \`${productAppPath}\`，Playground 保留为开发参考。\n\n## 安装与验证\n\n\`\`\`sh\npnpm install --frozen-lockfile --ignore-scripts\npnpm format\npnpm check\npnpm format:check\n\`\`\`\n\n## 本地查看\n\n分别启动自有服务：\n\n\`\`\`sh\npnpm dev:backend-mock --port 5330\npnpm dev -- --app ${identity.publicScope}/web\n\`\`\`\n\n前端默认5175，mock默认产品profile；管理员 \`admin@${identity.productSlug}.invalid\`、只读 \`viewer@${identity.productSlug}.invalid\`，密码 \`demo-only\`，仅本地合成数据。四页CRUD不改变登录账号或授权，重启mock恢复种子。\n\nPlayground参考须另起 \`MOCK_PROFILE=playground pnpm dev:backend-mock\`，并显式选择 \`pnpm dev -- --app ${identity.publicScope}/playground\`，不混用产品mock。\n\n产品构建：\`pnpm --filter ${identity.publicScope}/web build\`。生产交付不含mock。依赖/安装/服务/Git/发布均是独立动作；生成器没有代为执行。\n\n生成来源见 \`.template-source.json\`，工程规范见 \`AGENTS.md\` 和 \`docs/guide\`。\n`;
  }
  if (path === 'apps/backend-mock/README.md') {
    text = text
      .replaceAll('MOCK_PROFILE=starter', 'MOCK_PROFILE=' + identity.productSlug)
      .replaceAll('@starter.invalid', '@' + identity.productSlug + '.invalid');
  }
  if (path === 'docs/guide/structure.md')
    text = text.replace(
      '本仓库只有 playground/backend-mock',
      '本仓库包含产品 ' + productAppPath + '、playground参考和backend-mock',
    );
  if (path === 'pnpm-lock.yaml') {
    if (!/^lockfileVersion: ['"]?9\.0['"]?\s*$/m.test(text) || !/^ {2}apps\/web:\s*$/m.test(text))
      throw new Error('Unsupported lock importer structure');
  }
  return Buffer.from(text);
}
