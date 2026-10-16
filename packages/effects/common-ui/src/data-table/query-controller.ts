import { functionalUpdate } from '@tanstack/react-table';
import type { OnChangeFn, PaginationState, SortingState } from './types';
import type { QueryPage, QueryRequest, QueryTableState } from './query-types';

/** Query DTOs are copied at application and again at dispatch, never owned by a loader. */
function copyQuery<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyQuery) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyQuery(item)])) as T;
  }
  return value;
}

export function createQueryController<Q, R>(options: {
  load: (request: QueryRequest<Q>) => Promise<QueryPage<R>>;
  initialPageSize?: number;
}) {
  const pageSize = options.initialPageSize ?? 10;
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('initialPageSize must be a positive integer');
  let pagination: PaginationState = { pageIndex: 0, pageSize };
  let sorting: SortingState = [];
  let applied: { query: Q } | null = null;
  let load = options.load;
  let scopeKey: string | undefined;
  let active = false;
  let epoch = 0;
  let request: AbortController | undefined;
  const listeners = new Set<() => void>();
  const retire = () => {
    ++epoch;
    request?.abort();
    request = undefined;
  };
  const publish = (
    metadata: { readState: 'ready'; resultCount: number } | { readState: 'pending' | 'error'; resultCount: null },
    rows: readonly R[] = [],
    rowCount = 0,
    error: unknown = null,
  ) => {
    snapshot = {
      ...metadata,
      sourceCount: null,
      model: { kind: 'server', rows, rowCount },
      error,
      pagination: { kind: 'controlled', value: { ...pagination }, onChange: onPaginationChange },
      sorting: { kind: 'controlled', value: sorting.map(item => ({ ...item })), onChange: onSortingChange },
    };
    for (const listener of listeners) listener();
  };
  async function fetchPage(allowClamp = true): Promise<void> {
    if (!active || !applied) return;
    retire();
    const operation = epoch;
    const capturedScope = scopeKey;
    const abort = new AbortController();
    request = abort;
    const captured: QueryRequest<Q> = {
      query: copyQuery(applied.query),
      pagination: { ...pagination },
      sorting: sorting.map(item => ({ ...item })),
      signal: abort.signal,
    };
    const current = () => active && epoch === operation && scopeKey === capturedScope && !abort.signal.aborted;
    publish({ readState: 'pending', resultCount: null });
    try {
      const page = await load(captured);
      if (!current()) return;
      if (!Number.isSafeInteger(page.rowCount) || page.rowCount < 0) throw new Error('Invalid filtered rowCount');
      const lastPage = Math.max(0, Math.ceil(page.rowCount / captured.pagination.pageSize) - 1);
      if (captured.pagination.pageIndex > lastPage) {
        pagination = { ...captured.pagination, pageIndex: lastPage };
        if (allowClamp) {
          await fetchPage(false);
          return;
        }
        // One fallback only: another nonempty shrink needs an explicit reload.
        if (page.rowCount !== 0) throw new Error('Query page changed during fallback; reload to retry');
      }
      publish({ readState: 'ready', resultCount: page.rowCount }, page.rows, page.rowCount);
    } catch (error) {
      if (current()) publish({ readState: 'error', resultCount: null }, [], 0, error);
    }
  }
  const onPaginationChange: OnChangeFn<PaginationState> = updater => {
    const next = functionalUpdate(updater, { ...pagination });
    if (
      !Number.isInteger(next.pageIndex) ||
      next.pageIndex < 0 ||
      !Number.isInteger(next.pageSize) ||
      next.pageSize < 1
    )
      throw new Error('Invalid pagination');
    const normalized = { ...next, pageIndex: next.pageSize !== pagination.pageSize ? 0 : next.pageIndex };
    if (normalized.pageIndex === pagination.pageIndex && normalized.pageSize === pagination.pageSize) return;
    pagination = normalized;
    void fetchPage();
  };
  const onSortingChange: OnChangeFn<SortingState> = updater => {
    const next = functionalUpdate(
      updater,
      sorting.map(item => ({ ...item })),
    );
    if (JSON.stringify(next) === JSON.stringify(sorting)) return;
    sorting = next.map(item => ({ ...item }));
    pagination = { ...pagination, pageIndex: 0 };
    void fetchPage();
  };
  let snapshot: QueryTableState<R>;
  publish({ readState: 'pending', resultCount: null });
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setLoader(next: typeof options.load) {
      load = next;
    },
    hasApplied: () => applied !== null,
    configure(nextScope: string, enabled: boolean) {
      if (scopeKey === nextScope && active === enabled) return;
      retire();
      scopeKey = nextScope;
      active = enabled;
      publish({ readState: 'pending', resultCount: null });
    },
    beginQuery() {
      retire();
      return epoch;
    },
    isCurrent: (ticket: number) => active && epoch === ticket,
    async apply(query: Q, ticket?: number) {
      if (!active || (ticket !== undefined && ticket !== epoch)) return;
      applied = { query: copyQuery(query) };
      pagination = { ...pagination, pageIndex: 0 };
      await fetchPage();
    },
    reload: () => fetchPage(),
    cancel() {
      retire();
      publish({ readState: 'pending', resultCount: null });
    },
    deactivate() {
      retire();
      active = false;
      publish({ readState: 'pending', resultCount: null });
    },
  };
}
