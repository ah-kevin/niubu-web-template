import type { QueryPage, QueryRequest } from '@niubu/common-ui/data-table';

export type SyntheticRow = { id: string; name: string; score: number; active: boolean };
export type SyntheticTableLoader = (
  request: QueryRequest<{ term: string }>,
  scope: string,
) => Promise<QueryPage<SyntheticRow>>;

/** Synthetic records only. This is not an API adapter or a backend service. */
export const syntheticRows: readonly SyntheticRow[] = [
  { id: 'sample-1', name: 'Cedar', score: 40, active: true },
  { id: 'sample-2', name: 'Amber', score: 20, active: false },
  { id: 'sample-3', name: 'Birch', score: 10, active: true },
  { id: 'sample-4', name: 'Alpine', score: 30, active: false },
];

export const loadSyntheticTablePage: SyntheticTableLoader = (request, scope) =>
  new Promise((resolve, reject) => {
    const { signal } = request;
    if (signal.aborted) {
      reject(new DOMException('Synthetic read cancelled', 'AbortError'));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Synthetic read cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      const prefix = scope === 'south' ? 'South' : 'North';
      const term = request.query.term.toLowerCase();
      const rows = syntheticRows
        .map((row, index) => ({ ...row, id: `${scope}-${index + 1}`, name: `${prefix} · ${row.name}` }))
        .filter(row => row.name.toLowerCase().includes(term));
      const sort = request.sorting[0];
      if (sort) {
        rows.sort((a, b) => {
          const delta = sort.id === 'score' ? a.score - b.score : a.name.localeCompare(b.name);
          return sort.desc ? -delta : delta;
        });
      }
      const start = request.pagination.pageIndex * request.pagination.pageSize;
      resolve({ rows: rows.slice(start, start + request.pagination.pageSize), rowCount: rows.length });
    }, 120);
    signal.addEventListener('abort', abort, { once: true });
  });
