import type { BaseTableProps, TableAlignment } from './types';

export function columnAlignment(
  { align, columnAlign }: Pick<BaseTableProps<unknown>, 'align' | 'columnAlign'>,
  id: string,
): TableAlignment {
  return (columnAlign && Object.hasOwn(columnAlign, id) ? columnAlign[id] : undefined) ?? align ?? 'center';
}
