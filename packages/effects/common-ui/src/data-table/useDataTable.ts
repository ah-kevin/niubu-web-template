import { useTable, type TableFeatures, type RowData, type TableOptions, type ReactTable } from '@tanstack/react-table';
/** Private native hook. The public entry point exposes only the fixed profiles. */
export function useDataTable<F extends TableFeatures, T extends RowData>(
  options: TableOptions<F, T>,
): ReactTable<F, T> {
  return useTable(options);
}
