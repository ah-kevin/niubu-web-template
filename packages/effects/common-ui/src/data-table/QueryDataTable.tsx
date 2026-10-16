import type { RowData } from '@tanstack/react-table';
import type { FieldValues } from 'react-hook-form';
import type { CustomFieldParams } from '../form/types';
import { DataTable } from './DataTable';
import { useQueryDataTable } from './useQueryDataTable';
import type { QueryDataTableProps } from './query-types';

/** App owns columns, identities, preferences, selection, translation and the loader. */
export function QueryDataTable<
  V extends FieldValues,
  Q,
  R extends RowData,
  C extends CustomFieldParams = CustomFieldParams,
>({ table, ...options }: QueryDataTableProps<V, Q, R, C>) {
  const { queryForm, tableState } = useQueryDataTable<V, Q, R, C>(options);
  return (
    <>
      <queryForm.Form />
      <DataTable<R> {...table} {...tableState} />
    </>
  );
}
