export type QueryState = Readonly<{
  q: string;
  page: number;
  pageSize: 25 | 50 | 100;
  sort: string;
  direction: 'asc' | 'desc';
  filters: Readonly<Record<string, string[]>>;
}>;

export type ReadResult<T> =
  | { status: 'ready'; data: T; asOf: string; source: string }
  | { status: 'not-found' | 'forbidden' | 'not-enabled' | 'error'; message: string };

export type PageResult<T> = Readonly<{ rows: readonly T[]; total: number }>;
