import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
import { resolveConfig } from 'vite';
import {
  artifactFiles,
  artifactPath,
  hashBuildInputs,
  initialHtml,
  readWorkspace,
  readBuildContext,
  readBuildInputs,
  verifyBuildContext,
  sha256,
  assertRuntimeConfigHead,
  freezeRuntimeConfigDescriptor,
  parseRuntimeConfigScript,
  serializeRuntimeConfig,
} from '@niubu-internal/node-utils';
import type {
  BuildProvenance,
  BuildProvenanceApi,
  BuildContextSnapshot,
  FirstScreenRoots,
  RuntimeConfigDescriptor,
} from '@niubu-internal/node-utils';

export type Chunk = Readonly<{ gzipBytes: number; imports: readonly string[] }>;
const initialJavaScriptBudgetBytes = 512_000;
export function measureClosure(graph: ReadonlyMap<string, Chunk>, roots: readonly string[]) {
  const seen = new Set<string>();
  function visit(file: string) {
    if (seen.has(file)) return;
    const node = graph.get(file);
    if (!node) throw Error(`Required JavaScript dependency is absent: ${file}`);
    if (!Number.isSafeInteger(node.gzipBytes) || node.gzipBytes < 0) throw Error(`Invalid gzip6 bytes: ${file}`);
    seen.add(file);
    node.imports.forEach(visit);
  }
  roots.forEach(visit);
  const members = [...seen].sort(),
    gzipBytes = members.reduce((sum, file) => sum + graph.get(file)!.gzipBytes, 0);
  return { gzipBytes, gzipKiB: gzipBytes / 1024, withinBudget: gzipBytes <= initialJavaScriptBudgetBytes, members };
}
const same = (a: readonly string[], b: readonly string[]) =>
  JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort());
const strings = (values: unknown): values is string[] =>
  Array.isArray(values) && values.every(value => typeof value === 'string' && value.length > 0);

/** Measure only sealed, final artifacts from the caller's current source inputs. */
export function measureBuiltOverview({
  appRoot,
  expectedInputHash,
  expectedBuildContext,
  expectedRuntimeConfig,
  workspaceRoot = appRoot,
}: {
  appRoot: string;
  expectedInputHash: string;
  expectedBuildContext: BuildContextSnapshot;
  expectedRuntimeConfig?: RuntimeConfigDescriptor;
  workspaceRoot?: string;
}) {
  if (!/^[a-f0-9]{64}$/.test(expectedInputHash)) throw Error('A current source input hash is required');
  if (!expectedBuildContext) throw Error('A current expected build context is required');
  const dist = resolve(appRoot, expectedBuildContext.context.outDir);
  const read = (file: string) => readFileSync(artifactPath(dist, file));
  function json<T>(file: string): T {
    if (!existsSync(join(dist, file))) throw Error(`Missing build provenance or roots: ${file}`);
    try {
      return JSON.parse(read(file).toString()) as T;
    } catch {
      throw Error(`Invalid build provenance or roots: ${file}`);
    }
  }
  const provenance = json<BuildProvenance>('build-inputs.json');
  const rootsRecord = json<FirstScreenRoots>('first-screen-roots.json');
  verifyBuildContext(workspaceRoot, expectedInputHash, provenance.buildContext, expectedBuildContext);
  if (
    rootsRecord.contextHash !== expectedBuildContext.contextHash ||
    rootsRecord.base !== expectedBuildContext.context.base
  )
    throw Error('Root build context provenance differs');
  if (
    provenance.schemaVersion !== 1 ||
    provenance.inputHash !== expectedInputHash ||
    rootsRecord.schemaVersion !== 1 ||
    rootsRecord.inputHash !== expectedInputHash ||
    !provenance.appName ||
    rootsRecord.appName !== provenance.appName
  )
    throw Error('Stale or invalid build input provenance');
  // Keep the existing canonical hash algorithm; bind the seal's source metadata to that same snapshot.
  if (existsSync(join(workspaceRoot, 'pnpm-workspace.yaml'))) {
    const current = readBuildInputs(readWorkspace(workspaceRoot), provenance.appName);
    if (
      current.inputHash !== expectedInputHash ||
      Object.entries(current).some(
        ([key, value]) =>
          JSON.stringify((provenance as unknown as Record<string, unknown>)[key]) !== JSON.stringify(value),
      )
    )
      throw Error('Build source input/toolchain/appName provenance differs from current source selection');
  }
  if (!provenance.artifacts || typeof provenance.artifacts !== 'object' || Array.isArray(provenance.artifacts))
    throw Error('Missing artifact provenance');
  const files = artifactFiles(dist).filter(file => file !== 'build-inputs.json');
  if (!same(files, Object.keys(provenance.artifacts)))
    throw Error('Emitted artifact inventory differs from build provenance');
  const policy = expectedRuntimeConfig && freezeRuntimeConfigDescriptor(expectedRuntimeConfig);
  let runtimeConfig:
    | {
        file: string;
        generatedSha256: string;
        currentSha256: string;
        rawBytes: number;
        gzipBytes: number;
        changed: boolean;
      }
    | undefined;
  if (policy) {
    const declaration = provenance.runtimeConfig;
    const generatedSha256 = sha256(serializeRuntimeConfig(policy.defaults));
    if (
      !declaration ||
      typeof declaration !== 'object' ||
      Array.isArray(declaration) ||
      Object.keys(declaration).sort().join(',') !== 'file,generatedSha256,schemaVersion' ||
      declaration.file !== policy.fileName ||
      declaration.schemaVersion !== policy.schemaVersion ||
      declaration.generatedSha256 !== generatedSha256 ||
      provenance.artifacts[policy.fileName] !== generatedSha256
    )
      throw Error('Runtime configuration provenance differs from trusted source policy');
    if (!files.includes(policy.fileName)) throw Error('Missing runtime configuration artifact');
    const bytes = read(policy.fileName);
    parseRuntimeConfigScript(bytes.toString('utf8'));
    // String decoding must not turn malformed UTF-8 into another accepted script.
    if (!bytes.equals(Buffer.from(bytes.toString('utf8')))) throw Error('Invalid runtime configuration bytes');
    const currentSha256 = sha256(bytes);
    runtimeConfig = {
      file: policy.fileName,
      generatedSha256,
      currentSha256,
      rawBytes: bytes.length,
      gzipBytes: gzipSync(bytes, { level: 6 }).length,
      changed: currentSha256 !== generatedSha256,
    };
  } else if (Object.hasOwn(provenance, 'runtimeConfig')) {
    throw Error('Runtime configuration declaration has no trusted source policy');
  }
  for (const file of files)
    if (
      !/^[a-f0-9]{64}$/.test(provenance.artifacts[file]) ||
      (file !== policy?.fileName && sha256(read(file)) !== provenance.artifacts[file])
    )
      throw Error(`Final artifact hash differs from provenance: ${file}`);
  for (const file of ['index.html', '.vite/manifest.json', 'first-screen-roots.json'])
    if (!files.includes(file)) throw Error(`Missing required artifact provenance: ${file}`);
  const htmlBytes = read('index.html'),
    html = initialHtml(htmlBytes.toString(), rootsRecord.base ?? '/');
  if (JSON.stringify(html) !== JSON.stringify(rootsRecord.html))
    throw Error('HTML roots differ from sealed root provenance');
  if (policy) {
    assertRuntimeConfigHead(
      htmlBytes.toString(),
      `${rootsRecord.base}${policy.fileName}`,
      rootsRecord.themeInit && `${rootsRecord.base}${rootsRecord.themeInit.file}`,
    );
    if (!html.classicScripts.includes(policy.fileName))
      throw Error('Runtime configuration is missing from classic roots');
  }
  if (!rootsRecord.modules || !rootsRecord.variants || !Object.keys(rootsRecord.variants).length)
    throw Error('Missing named first-screen roots');
  const graph = new Map<string, Chunk>();
  const chunks = new Map<
    string,
    { file: string; sha256: string; rawBytes: number; gzipBytes: number; imports: string[]; dynamicImports: string[] }
  >();
  // Classic scripts can be anywhere under dist, including public boot resources.
  for (const file of files.filter(file => /\.[cm]?js$/.test(file))) {
    const bytes = read(file),
      source = ts.createSourceFile(file, bytes.toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports: string[] = [],
      dynamicImports: string[] = [];
    const emittedImport = (specifier: string) => {
      if (!specifier.startsWith('./') && !specifier.startsWith('../'))
        throw Error(`Unresolved external emitted import ${file}: ${specifier}`);
      const target = posix.normalize(posix.join(posix.dirname(file), specifier));
      artifactPath(dist, target);
      return target;
    };
    for (const statement of source.statements)
      if (
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ts.isStringLiteralLike(statement.moduleSpecifier)
      )
        imports.push(emittedImport(statement.moduleSpecifier.text));
    function walk(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
        dynamicImports.push(
          ts.isStringLiteralLike(node.arguments[0]) ? emittedImport(node.arguments[0].text) : '[computed import]',
        );
      ts.forEachChild(node, walk);
    }
    walk(source);
    const chunk = {
      file,
      sha256: sha256(bytes),
      rawBytes: bytes.length,
      gzipBytes: gzipSync(bytes, { level: 6 }).length,
      imports: [...new Set(imports)].sort(),
      dynamicImports: [...new Set(dynamicImports)].sort(),
    };
    chunks.set(file, chunk);
    graph.set(file, chunk);
  }
  for (const [label, module] of Object.entries(rootsRecord.modules)) {
    if (
      !module ||
      typeof module.source !== 'string' ||
      !strings(module.files) ||
      !module.files.length ||
      module.files.some(file => !graph.has(file))
    )
      throw Error(`Missing actual module to chunk mapping: ${label}`);
  }
  const common = [...html.entries, ...html.preloads, ...html.classicScripts];
  const variants = Object.fromEntries(
    Object.entries(rootsRecord.variants).map(([name, variant]) => {
      if (!variant || !strings(variant.requiredModules) || !variant.requiredModules.length || !strings(variant.roots))
        throw Error(`Invalid first-screen roots variant: ${name}`);
      const required = variant.requiredModules.flatMap(label => {
        if (!rootsRecord.modules[label]) throw Error(`Missing required first-screen module: ${label}`);
        return rootsRecord.modules[label].files;
      });
      if (!same(variant.roots, [...common, ...required])) throw Error(`Incomplete first-screen roots variant: ${name}`);
      return [
        name,
        {
          roots: [...new Set(variant.roots)].sort(),
          requiredModules: variant.requiredModules,
          ...measureClosure(graph, variant.roots),
        },
      ];
    }),
  );
  const members = [...new Set(Object.values(variants).flatMap(variant => variant.members))].sort();
  const union = measureClosure(graph, members);
  const manifest = json<Record<string, { file: string; css?: string[] }>>('.vite/manifest.json');
  const initialCss = new Set(html.stylesheets);
  for (const entry of Object.values(manifest))
    if (members.includes(entry.file)) entry.css?.forEach(file => initialCss.add(file));
  const css = files
    .filter(file => file.endsWith('.css'))
    .map(file => {
      const bytes = read(file);
      return {
        file,
        sha256: sha256(bytes),
        rawBytes: bytes.length,
        gzipBytes: gzipSync(bytes, { level: 6 }).length,
        initial: initialCss.has(file),
      };
    });
  for (const file of initialCss)
    if (!css.some(asset => asset.file === file)) throw Error(`Missing first-screen CSS artifact: ${file}`);
  return {
    ...union,
    // The historical size benchmark covers each variant and their deduplicated union; size is report-only.
    withinBudget: union.withinBudget && Object.values(variants).every(variant => variant.withinBudget),
    variants,
    inputHash: expectedInputHash,
    buildContext: provenance.buildContext,
    appName: provenance.appName,
    ...(runtimeConfig ? { runtimeConfig } : {}),
    algorithm: 'Per-file Node gzipSync level 6; deduplicated recursive emitted static ES import/export closure',
    limitBytes: initialJavaScriptBudgetBytes,
    // During architecture migration, size is recorded against the unchanged benchmark.
    sizePolicy: 'report-only' as const,
    versions: { node: process.version, zlib: process.versions.zlib, typescript: ts.version },
    provenanceSha256: sha256(read('build-inputs.json')),
    rootsSha256: sha256(read('first-screen-roots.json')),
    manifestSha256: sha256(read('.vite/manifest.json')),
    htmlSha256: sha256(htmlBytes),
    roots: [...new Set(Object.values(variants).flatMap(variant => variant.roots))].sort(),
    preloads: html.preloads,
    selectedDynamicRoots: [...new Set(Object.values(variants).flatMap(variant => variant.requiredModules))].sort(),
    chunks: members.map(file => chunks.get(file)!),
    allJavaScript: [...chunks.values()],
    nonJavaScript: {
      htmlBytes: htmlBytes.length,
      css,
      initialCssGzipBytes: css.filter(asset => asset.initial).reduce((sum, asset) => sum + asset.gzipBytes, 0),
    },
    scope:
      'Actual selected-app HTML entry/preloads/classic scripts plus configured first-screen modules; named variants include their real required resources. Browser network observations remain unaccepted.',
  };
}
export type BudgetReport = ReturnType<typeof measureBuiltOverview>;

export function resolveBudgetApp(root: string, appName?: string) {
  const caller = realpathSync(root);
  let workspaceRoot = caller;
  while (!existsSync(join(workspaceRoot, 'pnpm-workspace.yaml'))) {
    const parent = dirname(workspaceRoot);
    if (parent === workspaceRoot) throw Error('A workspace root is required for budget selection');
    workspaceRoot = parent;
  }
  const graph = readWorkspace(workspaceRoot);
  const apps = [...graph.packages.values()].filter(pkg =>
    relative(graph.root, pkg.root).replaceAll('\\', '/').startsWith('apps/'),
  );
  const inside = apps
    .filter(pkg => {
      const path = relative(pkg.root, caller);
      return path === '' || (!path.startsWith('..') && !path.startsWith('/'));
    })
    .sort((a, b) => b.root.length - a.root.length);
  const buildApps = apps.filter(pkg => {
    const scripts = pkg.manifest.scripts;
    return (
      scripts !== null && typeof scripts === 'object' && typeof (scripts as Record<string, unknown>).build === 'string'
    );
  });
  const selected = appName
    ? apps.find(pkg => pkg.name === appName)
    : (inside[0] ?? (buildApps.length === 1 ? buildApps[0] : apps.length === 1 ? apps[0] : undefined));
  if (!selected) throw Error('Select an app explicitly when the workspace budget target is ambiguous');
  return { graph, appName: selected.name, appRoot: selected.root };
}
export async function measureCurrentOverview(root: string, selectedApp?: string): Promise<BudgetReport> {
  const { graph, appRoot, appName } = resolveBudgetApp(root, selectedApp);
  const config = await resolveConfig({ root: appRoot }, 'build', 'production', 'production');
  const provenancePlugins = config.plugins.filter(plugin => plugin.name === 'niubu:build-provenance');
  if (provenancePlugins.length !== 1) throw Error('Exactly one trusted build provenance plugin is required');
  const api = provenancePlugins[0].api as BuildProvenanceApi | undefined;
  if (typeof api?.getRuntimeConfig !== 'function') throw Error('Trusted runtime configuration policy API is missing');
  const expectedInputHash = hashBuildInputs(graph, appName);
  const expectedBuildContext = readBuildContext(graph.root, expectedInputHash, {
    ...config,
    outDir: config.build.outDir,
  });
  const report = measureBuiltOverview({
    appRoot: config.root,
    workspaceRoot: graph.root,
    expectedInputHash,
    expectedBuildContext,
    expectedRuntimeConfig: api.getRuntimeConfig(),
  });
  if (report.appName !== appName) throw Error('Build provenance appName differs from current app selection');
  return report;
}
/** Shared executable entry: the optional reader lets tests use real sealed artifacts. */
export async function runBudgetCli(
  measure: () => BudgetReport | Promise<BudgetReport> = () => measureCurrentOverview(process.cwd()),
  outputFile = process.argv[2],
): Promise<void> {
  const result = await measure();
  if (outputFile) writeFileSync(outputFile, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  // Invalid provenance still throws above; exceeding the size benchmark is report-only.
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runBudgetCli();
}
