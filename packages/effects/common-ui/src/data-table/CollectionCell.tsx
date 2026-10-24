import { useTranslation } from '@niubu/locales/react';
import { CellText } from './CellText';

export type CollectionCellProps<T> = {
  items: readonly T[] | null | undefined;
  /** The caller supplies human-readable values; shared UI never guesses object fields. */
  describeItem: (item: T, index: number) => string;
  formatSummary?: (count: number) => string;
  emptyText?: string;
};
export function CollectionCell<T>({ items, describeItem, formatSummary, emptyText = '—' }: CollectionCellProps<T>) {
  const { t } = useTranslation();
  if (!items?.length) return <CellText value={null} emptyText={emptyText} />;
  return (
    <CellText
      value={formatSummary?.(items.length) ?? t('common:table.itemCount', { count: items.length })}
      detail={items.map(describeItem).join('\n')}
    />
  );
}
