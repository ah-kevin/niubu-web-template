import { expectTypeOf, it } from 'vitest';
import type { ColumnDef, ReactTable, TableOptions } from '@tanstack/react-table';
import { createListColumnHelper, createReadColumnHelper, createSelectableColumnHelper, createTreeColumnHelper } from './columns';
import { listFeatures, readFeatures, selectableListFeatures, treeFeatures } from './profiles';
import type { DataTableProps, ListTableProps, ReadTableProps, SliceOwner, TreeListTableProps } from './types';
type Item = { id: string; quantity: number; nullable: number | null };
it('preserves individual accessor types through native heterogeneous columns', () => {
  const helper = createListColumnHelper<Item>();
  const columns = helper.columns([
    helper.accessor('id', {
      id: 'id',
      cell: ctx => {
        expectTypeOf(ctx.getValue()).toEqualTypeOf<string>();
        return ctx.getValue();
      },
    }),
    helper.accessor('quantity', {
      id: 'quantity',
      cell: ctx => {
        expectTypeOf(ctx.getValue()).toEqualTypeOf<number>();
        // @ts-expect-error numeric accessor is not a string
        void ctx.getValue().toUpperCase;
        return String(ctx.getValue());
      },
    }),
    helper.accessor(row => row.nullable ?? undefined, {
      id: 'nullable',
      sortUndefined: 'last',
      sortFn: 'basic',
      cell: ctx => {
        expectTypeOf(ctx.getValue()).toEqualTypeOf<number | undefined>();
        return String(ctx.getValue());
      },
    }),
  ]);
  expectTypeOf(columns).toExtend<TableOptions<typeof listFeatures, Item>['columns']>();
  expectTypeOf(columns[1]).toExtend<ColumnDef<typeof listFeatures, Item, number>>();
});
// This function is checked by tsc but is deliberately never invoked with fabricated tables.
export function nativeFeatureBoundaries(
  read: ReactTable<typeof readFeatures, Item>,
  list: ReactTable<typeof listFeatures, Item>,
  select: ReactTable<typeof selectableListFeatures, Item>,
) {
  // @ts-expect-error read profile has no sorting setter
  read.setSorting([]);
  // @ts-expect-error read state has no sorting slice
  void read.state.sorting;
  // @ts-expect-error list profile has no selection setter
  list.setRowSelection({});
  select.setRowSelection({ real: true });
  // @ts-expect-error false selection entries must be removed, not retained
  select.setRowSelection({ real: false });
  const h = createReadColumnHelper<Item>();
  h.accessor('id', {
    // @ts-expect-error read columns cannot register sorting
    sortFn: 'basic',
  });
  const l = createListColumnHelper<Item>();
  l.accessor('id', {
    // @ts-expect-error no filtering in list profiles
    filterFn: 'includesString',
  });
  createSelectableColumnHelper<Item>().accessor('quantity', { sortFn: 'basic' });
}
export function optionsBoundaries(
  base: TableOptions<typeof listFeatures, Item>,
  read: ReadTableProps<Item>,
  list: ListTableProps<Item>,
) {
  const filtering: TableOptions<typeof listFeatures, Item> = {
    ...base,
    // @ts-expect-error filtering feature is absent
    manualFiltering: true,
  };
  const readServer: ReadTableProps<Item> = {
    ...read,
    // @ts-expect-error read does not accept server pagination
    model: { kind: 'server', rows: [], rowCount: 0 },
  };
  const arbitrary: DataTableProps<Item> = {
    ...list,
    // @ts-expect-error public API does not expose arbitrary SDK options
    autoResetAll: true,
  };
  // @ts-expect-error controlled slice requires matching callback
  const missing: SliceOwner<number> = { kind: 'controlled', value: 1 };
  // @ts-expect-error one slice cannot have an initial and controlled value
  const both: SliceOwner<number> = { kind: 'controlled', value: 1, onChange: () => {}, initial: 0 };
  const listSelection: ListTableProps<Item> = {
    ...list,
    // @ts-expect-error ordinary list cannot own row selection
    rowSelection: { kind: 'internal' },
  };
  const readSort: ReadTableProps<Item> = {
    ...read,
    // @ts-expect-error read does not expose sorting ownership
    sorting: { kind: 'internal' },
  };
  const readOptions: TableOptions<typeof readFeatures, Item> = {
    features: readFeatures,
    columns: read.columns,
    data: [],
    // @ts-expect-error native read options cannot turn on manual sorting
    manualSorting: true,
  };
  void [filtering, readServer, arbitrary, missing, both, listSelection, readSort, readOptions];
}
it('keeps nested accessor value inference when explicit IDs disambiguate native normalization', () => {
  const helper = createListColumnHelper<{ nested: { value: number }; nested_value: string }>();
  const columns = helper.columns([
    helper.accessor('nested.value', {
      id: 'nested-fact',
      cell: ctx => {
        expectTypeOf(ctx.getValue()).toEqualTypeOf<number>();
        return String(ctx.getValue());
      },
    }),
    helper.accessor('nested_value', {
      id: 'top-level-fact',
      cell: ctx => {
        expectTypeOf(ctx.getValue()).toEqualTypeOf<string>();
        return ctx.getValue();
      },
    }),
  ]);
  expectTypeOf(columns[0]).toExtend<
    ColumnDef<typeof listFeatures, { nested: { value: number }; nested_value: string }, number>
  >();
  expectTypeOf(columns[1]).toExtend<
    ColumnDef<typeof listFeatures, { nested: { value: number }; nested_value: string }, string>
  >();
});

it('preserves tree column accessor inference with its concrete native feature type', () => {
  const helper = createTreeColumnHelper<Item>();
  const columns = helper.columns([helper.accessor('quantity', { id: 'quantity', cell: ctx => {
    expectTypeOf(ctx.getValue()).toEqualTypeOf<number>();
    return String(ctx.getValue());
  } })]);
  expectTypeOf(columns).toExtend<TableOptions<typeof treeFeatures, Item>['columns']>();
});

// Compile-time boundaries: tree expansion and selection are native; pagination stays absent.
export function treeFeatureBoundaries(tree: ReactTable<typeof treeFeatures, Item>, list: ReactTable<typeof listFeatures, Item>, props: TreeListTableProps<Item>) {
  tree.setExpanded({ id: true });
  tree.toggleAllRowsExpanded();
  // @ts-expect-error expansion does not add pagination to this profile
  tree.setPagination({ pageIndex: 0, pageSize: 10 });
  tree.setRowSelection({ id: true });
  // @ts-expect-error list profile does not acquire tree APIs
  list.setExpanded(true);
  const noPage: TreeListTableProps<Item> = { ...props,
    // @ts-expect-error public tree props forbid a pagination owner
    pagination: { kind: 'internal' },
  };
  const noServer: TreeListTableProps<Item> = { ...props,
    // @ts-expect-error a paginated server result is not a complete tree model
    model: { kind: 'server', rows: [], rowCount: 0 },
  };
  void [noPage, noServer];
}
