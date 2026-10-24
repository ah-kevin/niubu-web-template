import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useTranslation } from '@niubu/locales/react';
import { DataTable } from './DataTable';
import { createReadColumnHelper, createListColumnHelper, createSelectableColumnHelper, createTreeColumnHelper } from './columns';
import { createDataTableLabels } from './labels';
import type { TableAlignment } from './types';
type RecordRow = { id: string; name: string; score: number; children?: RecordRow[] };
const rows: RecordRow[] = [{ id: 'one', name: 'Alpha', score: 42, children: [{ id: 'two', name: 'Beta', score: 13 }] }];
const ready = { readState: 'ready' as const, sourceCount: 1, resultCount: 1 };
const read = createReadColumnHelper<RecordRow>(), list = createListColumnHelper<RecordRow>(), select = createSelectableColumnHelper<RecordRow>(), tree = createTreeColumnHelper<RecordRow>();
const readColumns = read.columns([read.accessor('name', { id: 'name', header: 'Name' }), read.accessor('score', { id: 'score', header: 'Score' })]);
const listColumns = list.columns([list.accessor('name', { id: 'name', header: 'Name', size: 160, sortDescFirst: false }), list.accessor('score', { id: 'score', header: 'Score', size: 100 })]);
const selectableColumns = select.columns([select.accessor('name', { id: 'name', header: 'Name' }), select.accessor('score', { id: 'score', header: 'Score' })]);
const treeColumns = tree.columns([tree.accessor('name', { id: 'name', header: 'Name' }), tree.accessor('score', { id: 'score', header: 'Score' })]);
function Fixture({ profile = 'list', align, columnAlign, pinned = false, grouped = false }: {
 profile?: 'read' | 'list' | 'selectable-list' | 'tree-list'; align?: TableAlignment; columnAlign?: Readonly<Record<string, TableAlignment>>; pinned?: boolean; grouped?: boolean;
}) {
 const { t } = useTranslation();
 const common = { caption: 'Aligned records', getRowId: (row: RecordRow) => row.id, labels: createDataTableLabels(t, { name: 'Name', score: 'Score' }), model: { kind: 'client' as const, rows }, align, columnAlign, ...ready };
 if (profile === 'read') return <DataTable {...common} profile="read" columns={readColumns} />;
 if (profile === 'tree-list') return <DataTable {...common} profile="tree-list" columns={treeColumns} treeColumnId="name" getSubRows={row => row.children} getRowLabel={row => row.name} sourceCount={2} resultCount={2} />;
 if (profile === 'selectable-list') return <DataTable {...common} profile="selectable-list" columns={selectableColumns} rowSelection={{ kind: 'internal' }} selectionLabels={{ selectPage: 'Select page', selectRow: id => `Select ${id}`, selected: count => `${count} selected`, selectAllResults: count => `All ${count}`, clearSelection: 'Clear', allResultsUnavailable: 'Unavailable' }} />;
 return <DataTable {...common} profile="list" columns={grouped ? list.columns([list.group({ id: 'facts', header: 'Facts', columns: listColumns })]) : listColumns} {...(pinned ? { columnPinning: { kind: 'internal' as const, initial: { start: ['name', 'score'], end: [] } } } : {})} />;
}
it.each(['read', 'list', 'selectable-list', 'tree-list'] as const)('aligns headers and cells for the %s profile with an independent column override', profile => {
 render(<Fixture profile={profile} align="center" columnAlign={{ score: 'end' }} />);
 expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveStyle({ textAlign: 'center' });
 expect(screen.getByRole('columnheader', { name: /Score/ })).toHaveStyle({ textAlign: 'end' });
 expect(screen.getByRole('cell', { name: 'Alpha' })).toHaveStyle({ textAlign: 'center' });
 expect(screen.getByRole('cell', { name: '42' })).toHaveStyle({ textAlign: 'end' });
});
it('keeps the original start alignment when no option is supplied', () => {
 render(<Fixture />);expect(screen.getByRole('cell', { name: 'Alpha' })).toHaveStyle({ textAlign: 'start' });
 expect(screen.getByRole('button', { name: '排序 Name' })).toHaveClass('justify-start', 'pe-6', 'text-start');
});
it('centers sorted header content using symmetric padding without changing resize controls', () => {
 render(<Fixture align="center" />);const sort = screen.getByRole('button', { name: '排序 Name' });
 expect(sort).toHaveClass('justify-center', 'px-6', 'text-center');expect(sort).not.toHaveClass('pe-6');
 const resize = screen.getByRole('button', { name: '调整 Name 列宽' });expect(resize).toHaveClass('pattern-column-resizer');expect(resize).not.toHaveClass('px-6');
 fireEvent.click(sort);expect(sort.closest('th')).toHaveAttribute('aria-sort', 'ascending');
});
it('resolves a group header by its own column ID without overriding leaf choices', () => {
 render(<Fixture grouped align="center" columnAlign={{ facts: 'end', name: 'start' }} />);
 expect(screen.getByRole('columnheader', { name: /Facts/ })).toHaveStyle({ textAlign: 'end' });expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveStyle({ textAlign: 'start' });expect(screen.getByRole('cell', { name: '42' })).toHaveStyle({ textAlign: 'center' });
});
it('keeps sticky column offsets and keyboard resizing authoritative under center alignment', () => {
 render(<Fixture align="center" pinned />);
 const name = screen.getByRole('columnheader', { name: /Name/ }), score = screen.getByRole('columnheader', { name: /Score/ });
 expect(name).toHaveStyle({ position: 'sticky', width: '160px', textAlign: 'center' });expect(score).toHaveStyle({ insetInlineStart: '160px' });
 fireEvent.keyDown(screen.getByRole('button', { name: '调整 Name 列宽' }), { key: 'ArrowRight' });expect(name).toHaveStyle({ width: '170px' });expect(score).toHaveStyle({ insetInlineStart: '170px' });
});
it('centers a tree cell while retaining depth padding and disclosure behavior', () => {
 render(<Fixture profile="tree-list" align="center" />);fireEvent.click(screen.getByRole('button', { name: '展开 Alpha' }));
 const child = screen.getByRole('cell', { name: 'Beta' });const content = child.querySelector('.pattern-tree-cell');expect(content).toHaveClass('justify-center');expect(content).toHaveStyle({ paddingInlineStart: '20px' });
 expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
});

it('keeps a visible depth inset at the logical end of end-aligned tree cells', () => {
 render(<Fixture profile="tree-list" align="end" />);fireEvent.click(screen.getByRole('button',{name:'展开 Alpha'}));
 const parent=screen.getByRole('button',{name:'收起 Alpha'}).closest('.pattern-tree-cell');
 const child=screen.getByRole('cell',{name:'Beta'}).querySelector('.pattern-tree-cell');
 expect(parent).toHaveStyle({paddingInlineEnd:'0px'});expect(child).toHaveStyle({paddingInlineEnd:'20px',paddingInlineStart:'0px'});expect(child).toHaveClass('justify-end');
});
