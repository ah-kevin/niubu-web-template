import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import {
  artifactFiles,
  artifactPath,
  contains,
  hashBuildInputs,
  initialHtml,
  readBuildInputs,
  readBuildContext,
  readWorkspace,
  resolveWorkspaceImport,
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
  ThemeInitIifeEvidence,
  RuntimeConfigDescriptor,
} from '@niubu-internal/node-utils';
import type { Plugin, ResolvedConfig } from 'vite';
import { assertThemeInitHead, type ThemeInitOptions } from './theme-init-plugin.ts';

export interface FirstScreenOptions {
  appName: string;
  modules: Readonly<Record<string, string>>;
  variants: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
export function buildProvenance(options: {
  appRoot: string;
  workspaceRoot: string;
  firstScreen: FirstScreenOptions;
  themeInit?: ThemeInitOptions;
  runtimeConfig?: RuntimeConfigDescriptor;
}): Plugin & { api: BuildProvenanceApi } {
  let config: ResolvedConfig;
  let inputHash: string;
  let buildContext: BuildContextSnapshot;
  let modules: FirstScreenRoots['modules'];
  let themeEvidence: ThemeInitIifeEvidence | undefined;
  const runtimeConfig = options.runtimeConfig && freezeRuntimeConfigDescriptor(options.runtimeConfig);
  const selected = { ...options.firstScreen.modules };
  for (const additions of Object.values(options.firstScreen.variants))
    for (const [name, source] of Object.entries(additions)) {
      if (selected[name] && selected[name] !== source) throw Error(`Conflicting first-screen module label: ${name}`);
      selected[name] = source;
    }
  if (!Object.keys(options.firstScreen.modules).length || !Object.keys(options.firstScreen.variants).length)
    throw Error('First-screen modules and named variants are required');
  const graph = () => readWorkspace(options.workspaceRoot);
  function sourceFile(source: string) {
    if (source.startsWith('@') && !source.startsWith('@/')) {
      const resolved = resolveWorkspaceImport(graph(), join(options.appRoot, 'vite.config.ts'), source);
      if (resolved.kind !== 'workspace' || !resolved.isPublic)
        throw Error(`Missing public first-screen source: ${source}`);
      return resolved.file;
    }
    const file = isAbsolute(source) ? source : resolve(options.appRoot, source);
    if (!existsSync(file) || !contains(graph().root, realpathSync(file)))
      throw Error(`Missing workspace first-screen source: ${source}`);
    return realpathSync(file);
  }
  const currentContext = (hash: string) =>
    readBuildContext(options.workspaceRoot, hash, { ...config, outDir: config.build.outDir });
  function finalize() {
    const dist = resolve(config.root, config.build.outDir);
    // Invalidate any previous seal before checking the completed build.
    rmSync(join(dist, 'build-inputs.json'), { force: true });
    const inputs = readBuildInputs(graph(), options.firstScreen.appName);
    if (inputs.inputHash !== inputHash) throw Error('Build input provenance changed while building');
    if (currentContext(inputHash).contextHash !== buildContext.contextHash)
      throw Error('Build context inputs changed while building');
    const htmlText = readFileSync(join(dist, 'index.html'), 'utf8');
    const html = initialHtml(htmlText, config.base);
    if (options.themeInit) {
      if (!themeEvidence) throw Error('Missing theme-init IIFE evidence');
      assertThemeInitHead(htmlText, `${config.base}${themeEvidence.fileName}`);
      if (sha256(readFileSync(artifactPath(dist, themeEvidence.fileName))) !== sha256(themeEvidence.chunk.code))
        throw Error('Final theme-init bytes differ from emitted IIFE evidence');
    }
    if (!existsSync(join(dist, '.vite/manifest.json'))) throw Error('Final build manifest is missing');
    if (runtimeConfig) {
      const bytes = readFileSync(artifactPath(dist, runtimeConfig.fileName));
      parseRuntimeConfigScript(bytes.toString('utf8'));
      if (!bytes.equals(Buffer.from(serializeRuntimeConfig(runtimeConfig.defaults))))
        throw Error('Final runtime configuration bytes differ from trusted generated defaults');
      assertRuntimeConfigHead(
        htmlText,
        `${config.base}${runtimeConfig.fileName}`,
        themeEvidence && `${config.base}${themeEvidence.fileName}`,
      );
    }
    for (const [label, module] of Object.entries(modules)) {
      if (!module.files.length || module.files.some(file => !existsSync(artifactPath(dist, file))))
        throw Error(`Missing final first-screen module to chunk mapping: ${label}`);
    }
    const common = [...html.entries, ...html.preloads, ...html.classicScripts];
    const variants = Object.fromEntries(
      Object.entries(options.firstScreen.variants).map(([name, additions]) => {
        const requiredModules = [
          ...new Set([...Object.keys(options.firstScreen.modules), ...Object.keys(additions)]),
        ].sort();
        return [
          name,
          {
            requiredModules,
            roots: [...new Set([...common, ...requiredModules.flatMap(label => modules[label].files)])].sort(),
          },
        ];
      }),
    );
    const roots: FirstScreenRoots = {
      schemaVersion: 1,
      appName: options.firstScreen.appName,
      inputHash,
      base: config.base,
      contextHash: buildContext.contextHash,
      html,
      modules,
      variants,
      ...(themeEvidence
        ? {
            themeInit: {
              source: relative(graph().root, themeEvidence.entry).replaceAll('\\', '/'),
              file: themeEvidence.fileName,
              sha256: sha256(themeEvidence.chunk.code),
              modules: themeEvidence.chunk.moduleIds
                .filter(id => existsSync(id))
                .map(id => relative(graph().root, realpathSync(id)).replaceAll('\\', '/'))
                .sort(),
            },
          }
        : {}),
    };
    writeFileSync(join(dist, 'first-screen-roots.json'), JSON.stringify(roots, null, 2) + '\n');
    const artifacts = Object.fromEntries(
      artifactFiles(dist)
        .filter(file => file !== 'build-inputs.json')
        .map(file => [file, sha256(readFileSync(artifactPath(dist, file)))]),
    );
    const provenance: BuildProvenance = {
      ...inputs,
      schemaVersion: 1,
      artifacts,
      buildContext,
      ...(runtimeConfig
        ? {
            runtimeConfig: {
              file: runtimeConfig.fileName,
              schemaVersion: 1,
              generatedSha256: sha256(serializeRuntimeConfig(runtimeConfig.defaults)),
            },
          }
        : {}),
    };
    if (
      hashBuildInputs(graph(), options.firstScreen.appName) !== inputHash ||
      currentContext(inputHash).contextHash !== buildContext.contextHash
    )
      throw Error('Build input provenance changed while finalizing artifacts');
    writeFileSync(join(dist, 'build-inputs.json'), JSON.stringify(provenance, null, 2) + '\n');
  }
  return {
    name: 'niubu:build-provenance',
    apply: 'build',
    enforce: 'post',
    api: {
      finalize,
      getRuntimeConfig: () => runtimeConfig,
      registerThemeInitIife(evidence) {
        const expected =
          options.themeInit && realpathSync(resolve(config?.root ?? options.appRoot, options.themeInit.entry));
        if (!expected || !existsSync(evidence.entry) || realpathSync(evidence.entry) !== expected)
          throw Error('IIFE source is not the configured theme entry');
        artifactPath('.', evidence.fileName);
        const chunk = evidence.chunk;
        if (
          !chunk.isEntry ||
          !chunk.facadeModuleId ||
          !existsSync(chunk.facadeModuleId) ||
          realpathSync(chunk.facadeModuleId) !== expected ||
          !chunk.moduleIds.some(id => existsSync(id) && realpathSync(id) === expected)
        )
          throw Error('Theme-init IIFE module evidence is missing');
        if (chunk.imports.length || chunk.dynamicImports.length) throw Error('Theme-init IIFE must be self-contained');
        const covered = new Set(
          [...readBuildInputs(graph(), options.firstScreen.appName).inputs, ...(buildContext?.inputs ?? [])].map(
            input => resolve(graph().root, input.file),
          ),
        );
        for (const id of chunk.moduleIds) {
          const file = id.split('?')[0];
          if (existsSync(file) && !covered.has(realpathSync(file)))
            throw Error(`Theme-init module is outside canonical inputs: ${file}`);
        }
        themeEvidence = {
          ...evidence,
          chunk: {
            ...chunk,
            moduleIds: [...chunk.moduleIds],
            imports: [...chunk.imports],
            dynamicImports: [...chunk.dynamicImports],
          },
        };
      },
    },
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      rmSync(join(resolve(config.root, config.build.outDir), 'build-inputs.json'), { force: true });
      inputHash = hashBuildInputs(graph(), options.firstScreen.appName);
      buildContext = currentContext(inputHash);
      modules = Object.fromEntries(
        Object.entries(selected).map(([label, source]) => [
          label,
          { source: relative(graph().root, sourceFile(source)).replaceAll('\\', '/'), files: [] },
        ]),
      );
    },
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        if (options.themeInit) {
          if (!themeEvidence) throw Error('Missing theme-init IIFE evidence');
          const emitted = bundle[themeEvidence.fileName];
          if (
            !emitted ||
            emitted.type !== 'asset' ||
            sha256(typeof emitted.source === 'string' ? emitted.source : Buffer.from(emitted.source)) !==
              sha256(themeEvidence.chunk.code)
          )
            throw Error('Theme-init evidence does not bind the actual emitted asset');
          for (const value of Object.values(modules))
            if (realpathSync(join(options.workspaceRoot, value.source)) === realpathSync(themeEvidence.entry))
              value.files.push(themeEvidence.fileName);
        }
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          const ids = new Set(
            [...Object.keys(output.modules), ...(output.facadeModuleId ? [output.facadeModuleId] : [])]
              .map(id => id.split('?')[0])
              .filter(id => existsSync(id))
              .map(id => realpathSync(id)),
          );
          for (const value of Object.values(modules))
            if (ids.has(realpathSync(join(options.workspaceRoot, value.source)))) value.files.push(output.fileName);
        }
        for (const [label, value] of Object.entries(modules)) {
          value.files = [...new Set(value.files)].sort();
          if (!value.files.length)
            throw Error(`Missing actual first-screen module→chunk mapping: ${label} (${value.source})`);
        }
      },
    },
  };
}
