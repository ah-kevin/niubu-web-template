import type { CellSpan, CellSpanContext } from './advanced-types';

/** Derive a rectangular native-cell grid; covered cells are omitted, never emitted with span zero. */
export function resolveCellSpans<T>(
  rows: readonly T[],
  columnIds: readonly string[],
  getSpan?: (context: CellSpanContext<T>) => CellSpan | undefined,
  pins: readonly (string | false)[] = [],
  blockedRows: ReadonlySet<number> = new Set(),
): (Required<CellSpan> | null)[][] {
  const grid: (Required<CellSpan> | null)[][] = rows.map(() => columnIds.map(() => null));
  const occupied = rows.map(() => columnIds.map(() => false));
  rows.forEach((row, rowIndex) =>
    columnIds.forEach((columnId, columnIndex) => {
      if (occupied[rowIndex][columnIndex]) return;
      const requested = getSpan?.({ row, rowIndex, columnId, columnIndex, rows, columnIds });
      const size = (n: number | undefined, max: number) => (Number.isSafeInteger(n) && n! > 0 ? Math.min(n!, max) : 1);
      let colSpan = size(requested?.colSpan, columnIds.length - columnIndex);
      let rowSpan = size(requested?.rowSpan, rows.length - rowIndex);
      for (let c = 1; c < colSpan; c++) {
        if (pins[columnIndex + c] !== pins[columnIndex] || occupied[rowIndex][columnIndex + c]) {
          colSpan = c;
          break;
        }
      }
      for (let r = 0; r < rowSpan; r++) {
        if (
          (r > 0 && blockedRows.has(rowIndex + r)) ||
          blockedRows.has(rowIndex) ||
          Array.from({ length: colSpan }, (_, c) => occupied[rowIndex + r][columnIndex + c]).some(Boolean)
        ) {
          rowSpan = Math.max(1, r);
          break;
        }
      }
      grid[rowIndex][columnIndex] = { rowSpan, colSpan };
      for (let r = 0; r < rowSpan; r++)
        for (let c = 0; c < colSpan; c++) occupied[rowIndex + r][columnIndex + c] = true;
    }),
  );
  return grid;
}

/** Merge only adjacent equal groups in the current displayed order. */
export function mergeConsecutiveRows<T>(columnId: string, group: (row: T) => unknown) {
  return (context: CellSpanContext<T>): CellSpan | undefined => {
    if (context.columnId !== columnId) return;
    let end = context.rowIndex + 1;
    while (end < context.rows.length && Object.is(group(context.rows[end]), group(context.row))) end++;
    return { rowSpan: end - context.rowIndex };
  };
}
export function moveRowId(ids: readonly string[], from: string, to: string): string[] {
  const next = [...ids],
    start = next.indexOf(from),
    target = next.indexOf(to);
  if (start < 0 || target < 0 || start === target) return next;
  next.splice(start, 1);
  next.splice(target, 0, from);
  return next;
}
