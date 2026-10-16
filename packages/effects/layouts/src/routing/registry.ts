import { matchPath } from 'react-router-dom';
import type { RouteMeta } from '@niubu/core-typings';

type MatchingRoute = RouteMeta & Readonly<{ view?: string }>;
export function createRouteMatcher<M extends MatchingRoute>(
  routes: readonly M[],
  isSupportedEntityId: (id: string) => boolean,
) {
  return (path: string, search = ''): M | null => {
    try {
      decodeURIComponent(path);
    } catch {
      return null;
    }
    const matches = routes.filter(meta => {
      if (meta.path === '*' || !matchPath({ path: meta.path, end: true, caseSensitive: true }, path)) return false;
      const idIndex = meta.path.split('/').indexOf(':id');
      return idIndex === -1 || isSupportedEntityId(path.split('/')[idIndex] ?? '');
    });
    matches.sort(
      (a, b) => Number(a.path.includes(':')) - Number(b.path.includes(':')) || b.path.length - a.path.length,
    );
    const first = matches[0];
    if (!first) return null;
    const query = new URLSearchParams(search);
    return (
      matches.find(
        meta =>
          meta.path === first.path &&
          meta.view?.includes('=') &&
          query.get(meta.view.split('=')[0]) === meta.view.split('=')[1],
      ) ?? first
    );
  };
}
export function resolveRouteTitle(
  meta: Pick<RouteMeta, 'titleKey'> & { titleParams?: Readonly<{ titleKey: string }> },
  t: (key: string, params?: Readonly<Record<string, string | number>>) => string,
): string {
  return t(meta.titleKey, meta.titleParams ? { title: t(meta.titleParams.titleKey) } : undefined);
}
