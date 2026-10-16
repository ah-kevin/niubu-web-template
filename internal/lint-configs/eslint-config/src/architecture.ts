import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Rule } from 'eslint';
import type { WorkspaceGraph } from '@niubu-internal/node-utils';
import { contains, resolveWorkspaceImport, workspaceOwner } from '@niubu-internal/node-utils';
const resolveFilePath = (file: string) => (existsSync(file) ? realpathSync(file) : resolve(file));
const normalize = (path: string) => path.replaceAll('\\', '/');
const isPurePackage = (path: string) =>
  /^packages\/(?:core|types|utils)$/.test(path) ||
  /^packages\/@core\/base\/[^/]+$/.test(path) ||
  path === 'packages/@core/preferences';
const isPresentationModule = (packagePath: string, file: string) =>
  /^packages\/(?:common-ui|shadcn-ui|icons)$/.test(packagePath) ||
  /^packages\/@core\/ui-kit\/[^/]+$/.test(packagePath) ||
  /^packages\/effects\/(?:common-ui|layouts)$/.test(packagePath) ||
  (packagePath === 'packages/effects/plugins' && /\/src\/chart\//.test(normalize(file)));
function isDomainDirectory(sourceRoot: string, name: string): boolean {
  const directory = resolve(sourceRoot, 'domains', name);
  return existsSync(directory) && statSync(directory).isDirectory();
}
const withoutCodeExtension = (path: string) => path.replace(/\.[cm]?[jt]sx?$/, '');
const isTestSource = (path: string) =>
  /(?:^|\/)(?:tests?|__tests__|specs?|__specs__)(?:\/|$)/.test(path) ||
  /\.(?:test|spec)(?:\.[cm]?[jt]sx?)?$/.test(path);
// The rule visits both ESTree and TypeScript parser nodes. Keep the consumed
// shape local so config loading does not require an additional parser package.
interface Node {
  type: string;
  importKind?: string;
  exportKind?: string;
  specifiers: readonly { importKind?: string; exportKind?: string }[];
  source: Node;
  value?: unknown;
  expressions: readonly Node[];
  quasis: readonly { value: { cooked: string | null } }[];
  arguments: readonly Node[];
  callee: Node;
  name?: string;
}

function isTypeOnly(node: Node) {
  if (node.type === 'TSImportType') return true;
  if (node.type === 'ImportDeclaration') {
    return (
      node.importKind === 'type' ||
      (node.specifiers.length > 0 && node.specifiers.every(specifier => specifier.importKind === 'type'))
    );
  }
  if (node.type === 'ExportNamedDeclaration') {
    return (
      node.exportKind === 'type' ||
      (node.specifiers.length > 0 && node.specifiers.every(specifier => specifier.exportKind === 'type'))
    );
  }
  return node.type === 'ExportAllDeclaration' && node.exportKind === 'type';
}

export function createArchitectureRule(graph: WorkspaceGraph): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      schema: [],
      messages: { forbidden: '{{reason}}: {{target}}' },
    },
    create(context: Rule.RuleContext) {
      const owner = workspaceOwner(graph, context.filename);
      if (!owner) return {};
      const sourcePackage = owner;
      const sourceRoot = sourcePackage.sourceRoots[0];
      const filename = resolveFilePath(context.filename);
      const from = normalize(relative(sourceRoot, filename));
      const packagePath = normalize(relative(graph.root, sourcePackage.root));
      const core = isPurePackage(packagePath);
      const runtime = !packagePath.startsWith('internal/') && contains(sourceRoot, filename);
      if (!runtime || isTestSource(from)) return {};
      const report = (node: Node, reason: string, target: string) =>
        context.report({ node: node as unknown as Rule.Node, messageId: 'forbidden', data: { reason, target } });
      if (!from.startsWith('../') && /\.(?:js|jsx|mjs|cjs|mts|cts)$/.test(from)) {
        return {
          Program: (node: Node) => report(node, 'Runtime source must use approved TypeScript .ts or .tsx files', from),
        };
      }
      const domain = /^domains\/([^/]+)\//.exec(from)?.[1];
      const pureRead = Boolean(domain && withoutCodeExtension(from) === `domains/${domain}/read`);
      const model = core || Boolean(domain && from.startsWith(`domains/${domain}/model/`));
      const page = Boolean(domain && from.startsWith(`domains/${domain}/pages/`));
      const workflow = from.startsWith('workflows/');
      const router = from.startsWith('router/');
      const runtimePublicDomains = new Set<string>();

      function check(node: Node, raw: unknown) {
        if (typeof raw !== 'string') return;
        const resolution = resolveWorkspaceImport(graph, context.filename, raw);
        if (resolution.kind === 'unresolved') {
          report(node, resolution.reason, raw);
          return;
        }
        const targetPackage = resolution.kind === 'workspace' ? graph.packages.get(resolution.owner) : undefined;
        const target = resolution.kind === 'workspace' ? normalize(relative(sourceRoot, resolution.file)) : null;
        const targetPackagePath = targetPackage && normalize(relative(graph.root, targetPackage.root));
        const crossPackage = targetPackage && targetPackage.name !== sourcePackage.name;
        const targetDomain = target && /^domains\/([^/]+)(?:\/|$)/.exec(target)?.[1];
        const publicEntry =
          targetDomain &&
          isDomainDirectory(sourceRoot, targetDomain) &&
          (withoutCodeExtension(target) === `domains/${targetDomain}/read` ||
            target === `domains/${targetDomain}` ||
            withoutCodeExtension(target) === `domains/${targetDomain}/index`);
        const typeOnly = isTypeOnly(node);
        // C1's one app module composer consumes finite declarations, never domain queries.
        const moduleDeclaration =
          from === 'router/modules.ts' &&
          targetDomain &&
          isDomainDirectory(sourceRoot, targetDomain) &&
          withoutCodeExtension(target!) === `domains/${targetDomain}/module`;

        let reason = null;
        if (crossPackage && /(?:^|\/)apps\//.test(targetPackagePath!)) {
          reason = 'Packages cannot depend on apps';
        } else if (targetPackagePath?.startsWith('internal/')) {
          reason = 'Runtime modules cannot depend on internal tools';
        } else if (resolution.kind === 'external' && !sourcePackage.dependencies.has(resolution.name)) {
          reason = 'External dependencies must be declared in the importing manifest';
        } else if (crossPackage && !sourcePackage.dependencies.has(targetPackage!.name)) {
          reason = 'Workspace dependencies must be declared in the importing manifest';
        } else if (crossPackage && resolution.kind === 'workspace' && !resolution.isPublic) {
          reason = 'Cross-package imports must use explicit public exports';
        } else if (
          (core || pureRead || model) &&
          /^(react(?:-dom)?|react-router(?:-dom)?|recharts)(?:\/|$)/.test(raw)
        ) {
          reason = 'Pure core, model and read modules cannot depend on React or presentation';
        } else if (
          (core || pureRead || model) &&
          targetPackagePath &&
          resolution.kind === 'workspace' &&
          isPresentationModule(targetPackagePath, resolution.file)
        ) {
          reason = 'Pure modules cannot depend on UI packages';
        } else if (target && isTestSource(target)) {
          reason = 'Production modules cannot depend on test or spec sources';
        } else if (
          pureRead &&
          target &&
          (target.startsWith('shared/ui/') ||
            target.startsWith('shared/patterns/') ||
            target.startsWith(`domains/${domain}/pages/`) ||
            target.startsWith(`domains/${domain}/components/`) ||
            withoutCodeExtension(target) === `domains/${domain}/index`)
        ) {
          reason = 'Public pure-read entries cannot depend on presentation';
        } else if (
          model &&
          target &&
          (target.startsWith('shared/ui/') ||
            target.startsWith('shared/patterns/') ||
            target.startsWith(`domains/${domain}/pages/`) ||
            target.startsWith(`domains/${domain}/components/`))
        ) {
          reason = 'Pure domain models cannot depend on UI';
        } else if (domain && targetDomain && domain !== targetDomain) {
          reason = 'Domains cannot import another domain';
        } else if (domain && target && /^(?:app|router|workflows)\//.test(target)) {
          reason = 'Domains cannot depend on application assembly';
        } else if (page && target?.startsWith(`domains/${domain}/data/`)) {
          reason = 'Pages receive their view model through props and cannot import data readers';
        } else if (page && publicEntry && !typeOnly) {
          reason = 'Pages may use public domain types but cannot execute queries through a runtime barrel';
        } else if (from.startsWith('shared/') && target && /^(app|domains|static-data)\//.test(target)) {
          reason = 'Shared modules cannot depend on higher layers or static facts';
        } else if (from.startsWith('static-data/') && target && /^(app|router|workflows|domains)\//.test(target)) {
          reason = 'Static facts cannot depend on application or domain implementations';
        } else if (target?.startsWith('static-data/') && !from.startsWith('static-data/')) {
          const ownReader = domain && from === `domains/${domain}/data/static-reader.ts`;
          const ownFacts = domain && withoutCodeExtension(target) === `static-data/domains/${domain}`;
          if (!(ownReader && ownFacts)) reason = 'Only a domain static-reader may import its own static facts';
        } else if (packagePath.startsWith('apps/') && !domain && !from.startsWith('static-data/') && targetDomain) {
          const lazyPage =
            router && node.type === 'ImportExpression' && target.startsWith(`domains/${targetDomain}/pages/`);
          const assembly = workflow || router;
          if ((!assembly && !typeOnly) || (!publicEntry && !lazyPage && !moduleDeclaration)) {
            reason = 'Only workflows and route adapters may consume domain public entries or lazy route pages';
          } else if (publicEntry && !typeOnly && !workflow) {
            runtimePublicDomains.add(targetDomain);
            if (runtimePublicDomains.size > 1) reason = 'Multi-domain runtime query assembly belongs only in workflows';
          }
        }
        if (reason) report(node, reason, raw);
      }
      const rejectModelJsx = (node: Node) => {
        if (model || pureRead)
          report(node, 'Pure model and read sources cannot contain JSX or introduce automatic React runtime', from);
      };
      return {
        ImportDeclaration: (node: Node) => check(node, node.source.value),
        TSImportType: (node: Node) => check(node, node.source.value),
        ExportNamedDeclaration: (node: Node) => node.source && check(node, node.source.value),
        ExportAllDeclaration: (node: Node) => check(node, node.source.value),
        ImportExpression: (node: Node) => {
          const literal =
            node.source.type === 'TemplateLiteral' && node.source.expressions.length === 0
              ? node.source.quasis[0]?.value.cooked
              : node.source.value;
          if (typeof literal !== 'string')
            report(node, 'Use a literal module path so dependency boundaries can be checked', 'dynamic import');
          else check(node, literal);
        },
        CallExpression: (node: Node) => {
          if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
            const argument = node.arguments[0];
            const literal =
              argument?.type === 'TemplateLiteral' && argument.expressions.length === 0
                ? argument.quasis[0]?.value.cooked
                : argument?.value;
            if (typeof literal !== 'string')
              report(node, 'Use a literal module path so dependency boundaries can be checked', 'require');
            else check(node, literal);
          }
        },
        JSXElement: rejectModelJsx,
        JSXFragment: rejectModelJsx,
      };
    },
  } as unknown as Rule.RuleModule;
}
