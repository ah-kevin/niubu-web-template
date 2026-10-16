import type { QueryState } from '@niubu/core-typings';

export type FilterWhitelist = Readonly<Record<string, readonly string[]>>;
const scalarKeys = ['q', 'page', 'pageSize', 'sort', 'direction'] as const;
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const hasControls = (value: string) =>
  Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
const single = (params: URLSearchParams, key: string) => (params.getAll(key).length === 1 ? params.get(key) : null);
const clean = (value: string | null, limit: number) =>
  value && !hasControls(value) ? value.trim().slice(0, limit) : '';
/** URL input is untrusted; adapters can additionally whitelist domain filter values. */

export function parseQuery(
  params: URLSearchParams,
  allowedSort: readonly string[],
  allowedFilters?: FilterWhitelist,
): QueryState {
  const rawPage = single(params, 'page') ?? '';
  const number = /^[1-9]\d{0,6}$/.test(rawPage) ? Number(rawPage) : 1;
  const pageSize = single(params, 'pageSize');
  const sort = single(params, 'sort');
  const entries = new Map<string, string[]>();
  for (const [key, value] of params) {
    if (!key.startsWith('filter.')) continue;
    const name = key.slice(7);
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(name) || unsafeKeys.has(name)) continue;
    const filter = clean(value, 100);
    if (!filter || (allowedFilters && (!Object.hasOwn(allowedFilters, name) || !allowedFilters[name].includes(filter))))
      continue;
    const values = entries.get(name) ?? [];
    if (!values.includes(filter) && values.length < 50) entries.set(name, [...values, filter]);
  }
  return {
    q: clean(single(params, 'q'), 200),
    page: number,
    pageSize: pageSize === '50' ? 50 : pageSize === '100' ? 100 : 25,
    sort: sort && allowedSort.includes(sort) ? sort : (allowedSort[0] ?? ''),
    direction: single(params, 'direction') === 'desc' ? 'desc' : 'asc',
    filters: Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b))),
  };
}

export function writeQuery(query: QueryState): URLSearchParams {
  const raw = new URLSearchParams({
    q: query.q,
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
    direction: query.direction,
  });
  for (const key of Object.keys(query.filters).sort())
    for (const value of query.filters[key]) raw.append(`filter.${key}`, value);
  const normalized = parseQuery(raw, query.sort ? [query.sort] : []);
  const result = new URLSearchParams({
    page: String(normalized.page),
    pageSize: String(normalized.pageSize),
    direction: normalized.direction,
  });
  if (normalized.q) result.set('q', normalized.q);
  if (normalized.sort) result.set('sort', normalized.sort);
  for (const [key, values] of Object.entries(normalized.filters))
    for (const value of values) result.append(`filter.${key}`, value);
  return result;
}
/** Preserves adapter-owned scope, view, tab and return destination. */

export function mergeQuery(params: URLSearchParams, query: QueryState): URLSearchParams {
  const result = new URLSearchParams(params);
  for (const key of [...result.keys()])
    if (scalarKeys.includes(key as (typeof scalarKeys)[number]) || key.startsWith('filter.')) result.delete(key);
  for (const [key, value] of writeQuery(query)) result.append(key, value);
  return result;
}

export function parseTab(params: URLSearchParams, allowed: readonly string[], fallback = allowed[0] ?? ''): string {
  const tab = single(params, 'tab');
  return tab && allowed.includes(tab) ? tab : allowed.includes(fallback) ? fallback : (allowed[0] ?? '');
}
