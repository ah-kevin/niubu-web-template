import { existsSync, globSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contains, readWorkspace, resolveWorkspaceImport } from '@niubu-internal/node-utils';
import type { WorkspaceManifest } from '@niubu-internal/node-utils';
import ts from 'typescript';

interface TestOwnership {
  include: string[];
  exclude?: string[];
}
const ignored = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.pnpm-store/**',
  '**/.superpowers/**',
  '**/.turbo/**',
  '**/.nitro/**',
  '**/.output/**',
];
const e2e = (file: string) => /(?:^|\/)tests\/e2e(?:[^/]*)(?:\/|$)/.test(file.replaceAll('\\', '/'));
const tests = '**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}';
function project(manifest: WorkspaceManifest): TestOwnership | undefined {
  return (manifest.niubu as { test?: TestOwnership } | undefined)?.test;
}

function hasEmittedRuntime(source: ts.SourceFile): boolean {
  if (source.isDeclarationFile) return false;
  const emitted = ts.transpileModule(source.text, {
    fileName: source.fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      moduleDetection: ts.ModuleDetectionKind.Force,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      erasableSyntaxOnly: true,
      removeComments: true,
    },
    reportDiagnostics: true,
  });
  if (emitted.diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) return false;
  const javascript = ts.createSourceFile(
    `${source.fileName}.js`,
    emitted.outputText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  return javascript.statements.some(statement => {
    if (ts.isEmptyStatement(statement)) return false;
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) return false;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      // Type-only named imports can leave an empty module linkage under verbatim emit.
      return !(
        clause &&
        !clause.name &&
        clause.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.length === 0
      );
    }
    if (ts.isExportDeclaration(statement)) {
      // A local export/empty linkage does not create runtime implementation.
      return (
        Boolean(statement.moduleSpecifier) &&
        (!statement.exportClause ||
          ts.isNamespaceExport(statement.exportClause) ||
          statement.exportClause.elements.length > 0)
      );
    }
    return true;
  });
}

function hasImplementation(file: string, runtime: boolean): boolean {
  const source = readFileSync(file, 'utf8');
  if (!/\.[cm]?[jt]sx?$/.test(file)) {
    return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').trim() !== '';
  }
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (runtime) return hasEmittedRuntime(parsed);
  // Public type contracts remain meaningful source, even when they emit no JS.
  return parsed.statements.some(statement => {
    if (ts.isEmptyStatement(statement)) return false;
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) return false;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!clause) return true; // A bare import executes the referenced module.
      if (clause.isTypeOnly) return false;
      if (clause.name || (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))) return true;
      return Boolean(
        clause.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.some(element => !element.isTypeOnly),
      );
    }
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) return Boolean(statement.moduleSpecifier);
      if (ts.isNamespaceExport(statement.exportClause)) return true;
      return statement.exportClause.elements.length > 0;
    }
    return true;
  });
}

function hasRuntimeSource(root: string): boolean {
  return globSync('src/**/*.{ts,tsx,js,jsx}', { cwd: root }).some(file => {
    if (/(?:^|\/)(?:tests?|__tests__|specs?|__specs__)(?:\/|$)|\.(?:test|spec)\./.test(file)) return false;
    return hasImplementation(resolve(root, file), true);
  });
}

/** Checks the files consumed by workspace exports and owning Vitest projects. */
export function checkWorkspace(root: string): { errors: readonly string[] } {
  const errors: string[] = [];
  let graph: ReturnType<typeof readWorkspace>;
  try {
    graph = readWorkspace(root);
  } catch (error) {
    return { errors: [String(error)] };
  }
  const dependencies = new Map<string, string[]>();
  const owners = new Map<string, Set<string>>();
  const apps = new Set(
    [...graph.packages.values()]
      .filter(
        pkg =>
          relative(graph.root, pkg.root).replaceAll('\\', '/').startsWith('apps/') ||
          (pkg.root === graph.root && hasRuntimeSource(pkg.root)),
      )
      .map(pkg => pkg.name),
  );
  for (const pkg of graph.packages.values()) {
    const packagePath = relative(graph.root, pkg.root).replaceAll('\\', '/');
    const app = packagePath.startsWith('apps/');
    const publicPackage = packagePath.startsWith('packages/');
    if (app && !hasRuntimeSource(pkg.root)) {
      errors.push(`${pkg.name}: unimplemented app workspace has no runtime source`);
    }
    const sourceEntries: string[] = [];
    for (const [key, targets] of pkg.explicitExports) {
      if (key.includes('*') || targets.some(target => target.includes('*'))) {
        errors.push(`${pkg.name}: wildcard public export is forbidden: ${key}`);
        continue;
      }
      for (const target of targets) {
        const file = resolve(pkg.root, target);
        if (!target.startsWith('./') || !existsSync(file) || !statSync(file).isFile()) {
          errors.push(`${pkg.name}: public export ${key} source missing: ${target}`);
        } else if (!contains(pkg.root, realpathSync(file)) || /(?:^|\/)(?:dist|node_modules)\//.test(target)) {
          errors.push(`${pkg.name}: public export ${key} escapes source package: ${target}`);
        } else {
          sourceEntries.push(file);
        }
      }
    }
    if (
      pkg.root !== graph.root &&
      !app &&
      (!sourceEntries.length || sourceEntries.every(file => !hasImplementation(file, false)))
    )
      errors.push(`${pkg.name}: unimplemented workspace has no meaningful public source export`);
    if (publicPackage && sourceEntries.some(file => !contains(resolve(pkg.root, 'src'), realpathSync(file)))) {
      errors.push(`${pkg.name}: public export must point into its own source directory`);
    }
    const linked = [...pkg.dependencies].filter(name => graph.packages.has(name));
    dependencies.set(pkg.name, linked);
    if (app) {
      for (const name of linked) {
        if (name !== pkg.name && apps.has(name)) errors.push(`${pkg.name}: app cannot depend on app ${name}`);
      }
      for (const file of globSync('**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}', { cwd: pkg.root, exclude: ignored })) {
        const absolute = resolve(pkg.root, file);
        const source = ts.createSourceFile(absolute, readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true);
        function inspect(node: ts.Node) {
          let specifier: ts.Node | undefined;
          if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
          else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
          else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
            specifier = node.moduleReference.expression;
          else if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
          )
            specifier = node.arguments[0];
          if (specifier && ts.isStringLiteralLike(specifier)) {
            const target = resolveWorkspaceImport(graph, absolute, specifier.text);
            if (target.kind === 'workspace' && target.owner !== pkg.name && apps.has(target.owner))
              errors.push(`${pkg.name}: app cannot import app ${target.owner}: ${file}`);
          }
          ts.forEachChild(node, inspect);
        }
        inspect(source);
      }
    }
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      for (const [name, version] of Object.entries(pkg.manifest[field] ?? {})) {
        if (version.startsWith('workspace:') && !graph.packages.has(name)) {
          errors.push(`${pkg.name}: workspace dependency missing: ${name}`);
        }
      }
    }
    const ownership = project(pkg.manifest);
    if (ownership) {
      for (const file of globSync(ownership.include, {
        cwd: pkg.root,
        exclude: [...ignored, ...(ownership.exclude ?? [])],
      })) {
        const absolute = realpathSync(resolve(pkg.root, file));
        if (e2e(relative(graph.root, absolute))) {
          errors.push(`${pkg.name}: default test project includes dormant E2E: ${file}`);
          continue;
        }
        const selected = owners.get(absolute) ?? new Set<string>();
        selected.add(pkg.name);
        owners.set(absolute, selected);
      }
    }
  }
  const completed = new Set<string>();
  function visit(name: string, stack: string[]) {
    if (stack.includes(name)) {
      errors.push(`Workspace dependency cycle: ${[...stack, name].join(' -> ')}`);
      return;
    }
    if (completed.has(name)) return;
    for (const dependency of dependencies.get(name) ?? []) visit(dependency, [...stack, name]);
    completed.add(name);
  }
  for (const name of graph.packages.keys()) visit(name, []);
  for (const pkg of graph.packages.values()) {
    if (!relative(graph.root, pkg.root).replaceAll('\\', '/').startsWith('packages/')) continue;
    const seen = new Set<string>();
    function closure(name: string) {
      if (seen.has(name)) return;
      seen.add(name);
      const target = graph.packages.get(name)!;
      if (apps.has(target.name)) {
        errors.push(`${pkg.name}: shared package build closure depends on app ${name}`);
      }
      for (const dependency of dependencies.get(name) ?? []) closure(dependency);
    }
    closure(pkg.name);
  }
  for (const file of globSync(tests, { cwd: graph.root, exclude: ignored })) {
    if (e2e(file)) continue;
    const absolute = realpathSync(resolve(graph.root, file));
    const count = owners.get(absolute)?.size ?? 0;
    if (count !== 1) errors.push(`Test owner count is ${count}: ${file}`);
  }
  return { errors: [...new Set(errors)] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkWorkspace(process.argv[2] ?? process.cwd());
  if (result.errors.length) {
    result.errors.forEach(error => console.error(error));
    process.exitCode = 1;
  } else console.log('Workspace graph, source exports and test ownership passed.');
}
