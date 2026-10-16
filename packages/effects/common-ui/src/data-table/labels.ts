import type { TableLabels } from './types';
export type TableTranslator = (key: string, params?: Record<string, string | number>) => string;
/** Common copy is explicit even when the caller's default namespace is its app. */
export function createDataTableLabels(t: TableTranslator, headers: Readonly<Record<string, string>> = {}): TableLabels {
  return {
    pending: t('common:read.loading.title'),
    error: t('common:read.error.title'),
    sourceEmpty: t('common:read.source-empty.title'),
    filteredEmpty: t('common:read.empty.title'),
    sourceUnknown: t('common:table.sourceUnknown'),
    pageEmpty: t('common:table.pageEmpty'),
    previousPage: t('common:table.previous'),
    nextPage: t('common:table.next'),
    pageSize: t('common:table.pageSize'),
    settings: t('common:table.settings'),
    resetColumns: t('common:table.reset'),
    pinStart: t('common:table.pinStart'),
    pinEnd: t('common:table.pinEnd'),
    unpin: t('common:table.unpin'),
    columnName: id => (Object.hasOwn(headers, id) ? headers[id] : id),
    showColumn: name => t('common:table.showColumn', { name }),
    columnWidth: name => t('common:table.columnWidth', { name }),
    resizeColumn: name => t('common:table.resizeColumn', { name }),
    pinColumn: name => t('common:table.pinColumn', { name }),
    sortColumn: name => t('common:table.sortColumn', { name }),
    page: (page, count) => t('common:table.page', { page, count }),
    total: count => t('common:table.total', { count }),
  };
}
