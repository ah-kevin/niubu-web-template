import {
  tableFeatures,
  rowSortingFeature,
  createSortedRowModel,
  rowPaginationFeature,
  createPaginatedRowModel,
  columnVisibilityFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  createExpandedRowModel,
  sortFn_basic,
  sortFn_alphanumeric,
} from '@tanstack/react-table';
export const readFeatures = tableFeatures({});
export const listFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, alphanumeric: sortFn_alphanumeric },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnVisibilityFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
});
export const selectableListFeatures = tableFeatures({ ...listFeatures, rowSelectionFeature });
export const treeFeatures = tableFeatures({
  rowSelectionFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, alphanumeric: sortFn_alphanumeric },
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  columnVisibilityFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
});
