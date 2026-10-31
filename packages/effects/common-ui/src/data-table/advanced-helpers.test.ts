import { expect, it } from 'vitest';
import { mergeConsecutiveRows, moveRowId, resolveCellSpans } from './advanced-helpers';

it('recomputes adjacent merges for filtered/sorted visible rows and skips covered cells', () => {
  const rows = [{ group: 'A' }, { group: 'A' }, { group: 'B' }];
  const merge = mergeConsecutiveRows<{ group: string }>('group', row => row.group);
  expect(resolveCellSpans(rows, ['group', 'value'], merge).map(row => row[0])).toEqual([{ rowSpan: 2, colSpan: 1 }, null, { rowSpan: 1, colSpan: 1 }]);
  expect(resolveCellSpans([rows[0], rows[2], rows[1]], ['group'], merge).every(row => row[0]?.rowSpan === 1)).toBe(true);
  expect(resolveCellSpans(rows.slice(1), ['value'], merge).every(row => row[0]?.rowSpan === 1)).toBe(true);
});
it('clips spans at pinned groups, detail rows, page edges and occupied rectangles', () => {
  const span = () => ({ rowSpan: 9, colSpan: 9 });
  expect(resolveCellSpans([1, 2, 3], ['a', 'b', 'c'], span, ['start', false, false], new Set([1]))[0][0]).toEqual({ rowSpan: 1, colSpan: 1 });
  const grid = resolveCellSpans([1, 2], ['a', 'b', 'c'], ({ rowIndex, columnIndex }) => rowIndex === 0 && columnIndex === 1 ? { rowSpan: 2 } : rowIndex === 1 ? { colSpan: 3 } : {});
  expect(grid[1]).toEqual([{ rowSpan: 1, colSpan: 1 }, null, { rowSpan: 1, colSpan: 1 }]);
});
it('reorders stable IDs without mutating input and ignores unknown IDs', () => {
  const ids = ['a', 'b', 'c'];
  expect(moveRowId(ids, 'a', 'c')).toEqual(['b', 'c', 'a']);
  expect(moveRowId(ids, 'missing', 'c')).toEqual(ids);
  expect(ids).toEqual(['a', 'b', 'c']);
});
