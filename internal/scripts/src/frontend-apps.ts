import { relative } from 'node:path';
import { readWorkspace } from '@niubu-internal/node-utils';

export type FrontendApp = Readonly<{ name: string; root: string }>;

/** Use the existing build/provenance tooling marker, never a backend's generic build script. */
export function discoverFrontendApps(root: string): readonly FrontendApp[] {
  const graph = readWorkspace(root);
  const apps = [...graph.packages.values()]
    .filter(pkg => {
      const scripts = pkg.manifest.scripts as Record<string, unknown> | undefined;
      return (
        relative(graph.root, pkg.root).replaceAll('\\', '/').startsWith('apps/') &&
        typeof scripts?.build === 'string' &&
        scripts.build.trim() !== '' &&
        pkg.dependencies.has('@niubu-internal/vite-config')
      );
    })
    .map(({ name, root }) => ({ name, root }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!apps.length) throw Error('No frontend apps found in the workspace');
  return apps;
}

/** Interactive dev/preview requires an explicit choice unless there is exactly one frontend. */
export function selectFrontendApp(root: string, appName?: string): FrontendApp {
  const apps = discoverFrontendApps(root);
  if (appName !== undefined) {
    const selected = apps.find(app => app.name === appName);
    if (!selected) throw Error(`Unknown frontend app: ${appName}`);
    return selected;
  }
  const selected = apps.length === 1 ? apps[0] : undefined;
  if (!selected) throw Error('Frontend app selection is ambiguous; pass --app <workspace-name>');
  return selected;
}
