import type { RowData } from '@tanstack/react-table';
import type { FieldValues } from 'react-hook-form';
import type { SchemaFormApi, SchemaFormOptions } from '../form/schema-types';
import type { CustomFieldParams } from '../form/types';
import type {
  ListTableProps,
  PaginationState,
  SelectableTableProps,
  SliceOwner,
  SortingState,
  TableReadMetadata,
} from './types';

export type QueryPage<R> = { rows: readonly R[]; rowCount: number };
export type QueryRequest<Q> = { query: Q; pagination: PaginationState; sorting: SortingState; signal: AbortSignal };
export type QueryTableState<R> = TableReadMetadata & {
  model: { kind: 'server'; rows: readonly R[]; rowCount: number };
  pagination: Extract<SliceOwner<PaginationState>, { kind: 'controlled' }>;
  sorting: Extract<SliceOwner<SortingState>, { kind: 'controlled' }>;
  error: unknown | null;
};
export type QueryDataTableOptions<V extends FieldValues, Q, R, C extends CustomFieldParams = CustomFieldParams> = {
  queryForm: SchemaFormOptions<V, Q, C>;
  load: (request: QueryRequest<Q>) => Promise<QueryPage<R>>;
  /** Include auth generation in this opaque key when reentry must retire old requests. */
  scopeKey: string;
  enabled: boolean;
  initialPageSize?: number;
};
export type QueryDataTableApi<V extends FieldValues, Q, R, C extends CustomFieldParams = CustomFieldParams> = {
  queryForm: SchemaFormApi<V, Q, C>;
  tableState: QueryTableState<R>;
  query: () => Promise<void>;
  reset: () => Promise<void>;
  reload: () => Promise<void>;
  cancel: () => void;
};
type QueryOwned = 'model' | 'readState' | 'sourceCount' | 'resultCount' | 'pagination' | 'sorting';
export type QueryDataTableProps<
  V extends FieldValues,
  Q,
  R extends RowData,
  C extends CustomFieldParams = CustomFieldParams,
> = QueryDataTableOptions<V, Q, R, C> & {
  table: Omit<ListTableProps<R>, QueryOwned> | Omit<SelectableTableProps<R>, QueryOwned>;
};
