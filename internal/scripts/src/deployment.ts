import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { resolveConfig } from 'vite';
import { discoverFrontendApps, selectFrontendApp } from './frontend-apps.ts';
import { measureCurrentOverview } from './budget.ts';
const toolingRoot = fileURLToPath(new URL('../../..', import.meta.url));
function inside(root: string, path: string) {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}
function sourceFiles(root: string) {
  const result: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('Deployment artifacts must not contain symlinks');
      if (entry.isDirectory()) visit(file);
      else result.push(relative(root, file).replaceAll('\\', '/'));
    }
  };
  visit(root);
  return result;
}
function resourceBase(value: string) {
  if (value === './' || value === '') return '/';
  if (!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(value) || value.split('/').some(part => part === '.' || part === '..'))
    throw Error('Static deployment requires a local rooted resource base');
  if (value.startsWith('/api/')) throw Error('The API prefix is reserved for API responses');
  return value;
}
function nginxQuote(value: string) {
  if ([...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    throw Error('Invalid static asset name');
  return JSON.stringify(value).replaceAll('$', '\\$');
}
function nginxConfig(dist: string, base: string, publicDir: string | false) {
  // The source-resolved budget check has validated this manifest and theme evidence.
  // A sealed public file still has a stable URL, even when its name resembles a hash.
  const publicFiles = new Set(publicDir && existsSync(publicDir) ? sourceFiles(publicDir) : []);
  const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8')) as Record<
    string,
    { file?: unknown; css?: unknown; assets?: unknown }
  >;
  const roots = JSON.parse(readFileSync(join(dist, 'first-screen-roots.json'), 'utf8')) as {
    themeInit?: { file?: unknown };
  };
  const names = new Set<string>();
  const add = (value: unknown) => {
    if (
      typeof value === 'string' &&
      /^assets\/.+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(value) &&
      !/\.html$/i.test(value) &&
      !publicFiles.has(value)
    )
      names.add(value);
  };
  for (const entry of Object.values(manifest)) {
    [
      entry.file,
      ...(Array.isArray(entry.css) ? entry.css : []),
      ...(Array.isArray(entry.assets) ? entry.assets : []),
    ].forEach(add);
  }
  add(roots.themeInit?.file);
  const assets = [...names]
    .sort()
    .map(file => '    ' + nginxQuote('/' + file) + ' "public,max-age=31536000,immutable";')
    .join('\n');
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mapping = base === '/' ? '' : `    ~^${escaped}(.*)$ /$1;`;
  const template = readFileSync(join(toolingRoot, 'deploy/nginx.conf'), 'utf8');
  if (template.split('__ASSET_CACHE_MAP__').length !== 2 || template.split('__BASE_RESOURCE_MAP__').length !== 2)
    throw Error('Invalid deployment nginx template');
  return template.replace('__ASSET_CACHE_MAP__', assets).replace('__BASE_RESOURCE_MAP__', mapping);
}
/** Packages already-sealed assets. Only source-resolved frontend policy can authorize the copy. */
export async function prepareDeployment({
  workspaceRoot,
  appName,
  outDir,
}: {
  workspaceRoot: string;
  appName: string;
  outDir: string;
}): Promise<void> {
  const root = realpathSync(workspaceRoot),
    app = discoverFrontendApps(root).find(candidate => candidate.name === appName);
  if (!app) throw Error('Unknown frontend app');
  const appRoot = realpathSync(app.root);
  if (!inside(root, appRoot)) throw Error('Frontend source escapes the workspace');
  const output = resolve(outDir);
  if (output === root || output === appRoot || inside(appRoot, output) || existsSync(output))
    throw Error('Deployment output must be a new independent directory');
  const config = await resolveConfig({ root: appRoot }, 'build', 'production', 'production');
  const dist = realpathSync(resolve(config.root, config.build.outDir));
  if (!inside(root, dist)) throw Error('Frontend output escapes the workspace');
  const measured = await measureCurrentOverview(root, appName);
  if (!measured.runtimeConfig) throw Error('Static deployment requires the source runtime-config policy');
  const files = sourceFiles(dist);
  for (const file of files)
    if (
      /\.(?:js|html)$/.test(file) &&
      readFileSync(join(dist, file), 'utf8').includes('NIUBU_BACKEND_MOCK_ONLY_STAGE3')
    )
      throw Error('Mock backend code cannot enter deployment');
  const nginx = nginxConfig(dist, resourceBase(config.base), config.publicDir);
  const contract = ts.transpileModule(
    readFileSync(join(toolingRoot, 'packages/@core/base/shared/src/runtime-config.ts'), 'utf8'),
    { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } },
  );
  if (
    contract.diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error) ||
    /\b(?:import|require)\s*(?:\(|[{*'"\\])/.test(contract.outputText)
  )
    throw Error('Runtime config contract must compile without runtime dependencies');
  mkdirSync(output, { recursive: true });
  cpSync(dist, join(output, 'html'), { recursive: true, errorOnExist: true, force: false });
  mkdirSync(join(output, 'runtime'));
  writeFileSync(join(output, 'nginx.conf'), nginx);
  writeFileSync(join(output, 'runtime/runtime-config-contract.mjs'), contract.outputText);
  cpSync(join(toolingRoot, 'deploy/runtime-config.mjs'), join(output, 'runtime/runtime-config.mjs'));
  writeFileSync(
    join(output, 'runtime/deployment.json'),
    JSON.stringify({ schemaVersion: 1, appName, runtimeConfig: '_app.config.js' }) + '\n',
  );
}
export async function runDeploymentCli(args = process.argv.slice(2)): Promise<void> {
  let appName: string | undefined,
    outDir = '/out',
    build = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (seen.has(key)) throw Error('Duplicate deployment option');
    seen.add(key);
    if (key === '--build') build = true;
    else if (key === '--app' || key === '--out') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw Error('Missing deployment option value');
      if (key === '--app') appName = value;
      else outDir = value;
    } else throw Error('Unknown deployment option');
  }
  const root = process.cwd();
  appName = selectFrontendApp(root, appName).name;
  if (build) {
    const result = spawnSync('pnpm', ['--filter', appName, 'build'], { cwd: root, shell: false, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error('Frontend build failed');
  }
  console.log(JSON.stringify(await measureCurrentOverview(root, appName), null, 2));
  await prepareDeployment({ workspaceRoot: root, appName, outDir });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void runDeploymentCli().catch(error => {
    console.error(error instanceof Error ? error.message : 'Static deployment preparation failed');
    process.exitCode = 1;
  });
