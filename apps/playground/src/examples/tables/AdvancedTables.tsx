import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DataTable,
  CellText,
  RowActions,
  createDataTableLabels,
  createListColumnHelper,
  createReadColumnHelper,
  createSelectableColumnHelper,
  mergeConsecutiveRows,
  type TableColumnFilters,
  type TableReadMetadata,
  type RowSelectionState,
  type SortingState,
} from '@niubu/common-ui/data-table';
import { formatDateOnly, formatQuantity } from '@niubu/locales';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Input } from '@niubu/shadcn-ui/input';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { Select } from '@niubu/shadcn-ui/select';
import { ExampleSection } from '../ExamplePage';
import { advancedTablesCopy } from './advanced-copy';

type DemoRow = {
  id: string;
  tag: string;
  zone: 'A' | 'B';
  pen: string;
  status: 'normal' | 'pending' | 'reviewed';
  weight: number;
  age: number;
  note: string;
  count: number;
};
const seed: readonly DemoRow[] = [
  {
    id: 'a1',
    tag: 'NB-2026-0418',
    zone: 'A',
    pen: 'A-1',
    status: 'normal',
    weight: 486.5,
    age: 612,
    note: 'longNote',
    count: 38,
  },
  {
    id: 'a2',
    tag: 'NB-2026-0421',
    zone: 'A',
    pen: 'A-2',
    status: 'pending',
    weight: 452,
    age: 401,
    note: 'longNote',
    count: 22,
  },
  {
    id: 'b1',
    tag: 'NB-2026-0433',
    zone: 'B',
    pen: 'B-1',
    status: 'normal',
    weight: 418.2,
    age: 520,
    note: 'longNote',
    count: 30,
  },
  {
    id: 'b2',
    tag: 'NB-2026-0440',
    zone: 'B',
    pen: 'B-2',
    status: 'pending',
    weight: 401.9,
    age: 355,
    note: 'longNote',
    count: 28,
  },
  {
    id: 'b3',
    tag: 'NB-2026-0452',
    zone: 'B',
    pen: 'B-3',
    status: 'normal',
    weight: 377.4,
    age: 730,
    note: 'longNote',
    count: 12,
  },
];
const helper = createListColumnHelper<DemoRow>();
const selectionHelper = createSelectableColumnHelper<DemoRow>();
const readHelper = createReadColumnHelper<DemoRow>();
const getRowId = (row: DemoRow) => row.id;
const ready = (rows: readonly DemoRow[], sourceCount = rows.length) => ({
  readState: 'ready' as const,
  sourceCount,
  resultCount: rows.length,
});

function useDemo() {
  const { t, locale } = useTranslation('app', advancedTablesCopy);
  const text = useCallback(
    (key: string, params?: Record<string, string | number>) => t(`examples.advancedTables.${key}`, params),
    [t],
  );
  const number = useCallback(
    (value: number, precision = 0) =>
      formatQuantity(
        { value, unit: '', quality: 'known' },
        { locale, precision, labels: { missing: text('missing'), unknown: text('unknown') } },
      ),
    [locale, text],
  );
  const date = (value: string) => formatDateOnly(value, { locale });
  const headers = Object.fromEntries(
    ['tag', 'zone', 'pen', 'status', 'weight', 'age', 'note', 'entered', 'owner', 'updated', 'actions', 'count'].map(
      id => [id, text(id === 'tag' ? 'id' : id)],
    ),
  );
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('tag', { id: 'tag', header: text('id'), size: 190 }),
        helper.accessor('zone', {
          id: 'zone',
          header: text('zone'),
          cell: ctx => text(ctx.getValue() === 'A' ? 'zoneA' : 'zoneB'),
        }),
        helper.accessor('pen', { id: 'pen', header: text('pen') }),
        helper.accessor('status', { id: 'status', header: text('status'), cell: ctx => text(ctx.getValue()) }),
        helper.accessor('weight', { id: 'weight', header: text('weight'), cell: ctx => number(ctx.getValue(), 1) }),
        helper.accessor('note', {
          id: 'note',
          header: text('note'),
          size: 280,
          enableSorting: false,
          cell: ctx => <CellText value={text(ctx.getValue())} />,
        }),
      ]),
    [text, number],
  );
  const selectable = useMemo(
    () =>
      selectionHelper.columns([
        selectionHelper.accessor('tag', { id: 'tag', header: text('id'), size: 190 }),
        selectionHelper.accessor('pen', { id: 'pen', header: text('pen') }),
        selectionHelper.accessor('status', { id: 'status', header: text('status'), cell: ctx => text(ctx.getValue()) }),
        selectionHelper.accessor('weight', {
          id: 'weight',
          header: text('weight'),
          cell: ctx => number(ctx.getValue(), 1),
        }),
      ]),
    [text, number],
  );
  const labels = createDataTableLabels(t, headers);
  const selectionLabels = {
    selectPage: text('selectPage'),
    selectRow: (id: string) => text('selectRow', { id }),
    selected: (count: number) => text('selected', { count }),
    selectAllResults: (count: number) => text('selectAll', { count }),
    clearSelection: text('clearSelection'),
    allResultsUnavailable: text('unavailable'),
  };
  const filterFields = {
    zone: {
      label: text('filterGroup'),
      options: [
        { value: 'A', label: text('zoneA') },
        { value: 'B', label: text('zoneB') },
      ],
    },
    status: {
      label: text('filterStatus'),
      options: ['normal', 'pending', 'reviewed'].map(value => ({ value, label: text(value) })),
    },
  };
  const filters: TableColumnFilters<DemoRow> = {
    mode: 'local',
    fields: filterFields,
    clearLabel: text('clearFilters'),
    activeLabel: text('filtered'),
    matches: (row, id, value) => (id === 'zone' ? row.zone === value : row.status === value),
  };
  return { text, number, date, columns, selectable, labels, selectionLabels, filters };
}
function Block({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <div id={`advanced-${id}`} className="min-w-0 scroll-mt-4">
      <ExampleSection title={title} description={hint}>
        {children}
      </ExampleSection>
    </div>
  );
}
function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={value => onChange(value === true)} />
      {children}
    </label>
  );
}
/** Synthetic persistence supports cancellation and deterministic failure without network requests. */
async function saveDemo(signal: AbortSignal, fail = false) {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 650);
    signal.addEventListener('abort', abort, { once: true });
  });
  if (signal.aborted) throw signal.reason;
  if (fail) throw new Error('Synthetic persistence failure');
}
export type AdvancedTableScenario =
  'choose' | 'read' | 'selection' | 'single' | 'layout' | 'header' | 'expand' | 'edit' | 'merge' | 'drag' | 'states';
export interface AdvancedTablesProps {
  /** Each route renders one scenario. Omit for the locally navigable chooser. */
  scenario?: AdvancedTableScenario;
  /** The app supplies its own route URLs, including the separately owned tree example. */
  scenarioHref?: (scenario: AdvancedTableScenario | 'tree') => string;
}
export function AdvancedTables({ scenario = 'choose', scenarioHref }: AdvancedTablesProps = {}) {
  const { text } = useDemo();
  const [localScenario, setLocalScenario] = useState<AdvancedTableScenario | null>(null);
  const active = localScenario ?? scenario;
  const choices = [
    'read',
    'selection',
    'single',
    'layout',
    'header',
    'expand',
    'edit',
    'merge',
    'drag',
    'tree',
  ] as const;
  const examples: Record<Exclude<AdvancedTableScenario, 'choose'>, ReactNode> = {
    read: <ReadExample />,
    selection: <SelectionExample mode="selection" />,
    single: <SelectionExample mode="single" />,
    layout: <LayoutExample />,
    header: <HeaderExample />,
    expand: <ExpandExample />,
    edit: <EditExample />,
    merge: <MergeExample />,
    drag: <DragExample />,
    states: <StatesExample />,
  };
  const link = (id: AdvancedTableScenario | 'tree') => scenarioHref?.(id) ?? `#advanced-${id}`;
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, id: AdvancedTableScenario | 'tree') => {
    if (scenarioHref) return;
    event.preventDefault();
    if (id === 'tree') {
      document
        .querySelector('.pattern-tree-cell')
        ?.closest('section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setLocalScenario(id);
  };
  return (
    <div className="grid min-w-0 gap-[var(--workspace-section-gap)]">
      {active === 'choose' ? (
        <Block id="choose" title={text('choose')} hint={text('intro')}>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['scenario', 'use', 'notes'].map(key => (
                    <th key={key} className="border-b border-border p-2 text-start">
                      {text(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {choices.map(id => (
                  <tr key={id}>
                    <td className="border-b border-border p-2">{text(id).split(' · ')[1]}</td>
                    <td className="border-b border-border p-2">
                      <a className="text-primary-text underline" href={link(id)} onClick={event => navigate(event, id)}>
                        {text(id).split(' · ')[0]} · {text('demo')}
                      </a>
                    </td>
                    <td className="border-b border-border p-2">{text(`${id}Hint`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a className="text-primary-text underline" href={link('states')} onClick={event => navigate(event, 'states')}>
            {text('states')}
          </a>
        </Block>
      ) : (
        <>
          <a
            className="w-fit text-primary-text underline"
            href={link('choose')}
            onClick={event => navigate(event, 'choose')}
          >
            {text('back')}
          </a>
          {examples[active]}
        </>
      )}
    </div>
  );
}
function ReadExample() {
  const { text, number, labels } = useDemo();
  const columns = readHelper.columns([
    readHelper.accessor('tag', { id: 'tag', header: text('id') }),
    readHelper.accessor('weight', { id: 'weight', header: text('weight'), cell: ctx => number(ctx.getValue(), 1) }),
    readHelper.accessor('note', {
      id: 'note',
      header: text('note'),
      cell: ctx => <CellText value={text(ctx.getValue())} />,
    }),
  ]);
  return (
    <Block id="read" title={text('read')} hint={text('readHint')}>
      <DataTable
        profile="read"
        model={{ kind: 'client', rows: seed }}
        {...ready(seed)}
        columns={columns}
        labels={labels}
        getRowId={getRowId}
        caption={text('read')}
        columnAlign={{ weight: 'end', note: 'start' }}
      />
    </Block>
  );
}
function SelectionExample({ mode }: { mode: 'selection' | 'single' }) {
  const { text, selectable, labels, selectionLabels } = useDemo();
  const [rows, setRows] = useState(seed);
  const [selected, setSelected] = useState<RowSelectionState>({});
  const [message, setMessage] = useState('');
  const count = Object.values(selected).filter(Boolean).length;
  return (
    <>
      {mode === 'selection' && (
        <Block id="selection" title={text('selection')} hint={text('selectionHint')}>
          <Button
            type="button"
            disabled={!count}
            onClick={() => {
              setRows(previous => previous.map(row => (selected[row.id] ? { ...row, status: 'reviewed' } : row)));
              setSelected({});
              setMessage(text('bulkDone', { count }));
            }}
          >
            {text('bulk')}
          </Button>
          {message && <p role="status">{message}</p>}
          <DataTable
            profile="selectable-list"
            model={{ kind: 'client', rows }}
            {...ready(rows)}
            columns={selectable}
            labels={labels}
            getRowId={getRowId}
            caption={text('selection')}
            selectionLabels={selectionLabels}
            rowSelection={{ kind: 'controlled', value: selected, onChange: setSelected }}
            pagination={{ kind: 'internal', initial: { pageIndex: 0, pageSize: 2 } }}
          />
        </Block>
      )}
      {mode === 'single' && (
        <Block id="single" title={text('single')} hint={text('singleHint')}>
          <DataTable
            profile="selectable-list"
            model={{ kind: 'client', rows: seed }}
            {...ready(seed)}
            columns={selectable}
            labels={labels}
            getRowId={getRowId}
            caption={text('single')}
            selectionMode="single"
            selectionLabels={selectionLabels}
            rowSelection={{ kind: 'internal' }}
          />
        </Block>
      )}
    </>
  );
}
function LayoutExample() {
  const { text, number, date, labels, selectionLabels } = useDemo();
  const [striped, setStriped] = useState(false),
    [bordered, setBordered] = useState(false),
    [wrap, setWrap] = useState(true);
  const [viewed, setViewed] = useState<string | null>(null);
  const rows = seed.flatMap((row, index) =>
    Array.from({ length: 4 }, (_, copy) => ({
      ...row,
      id: `${row.id}-${copy}`,
      tag: `${row.tag}-${index * 4 + copy}`,
    })),
  );
  const columns = selectionHelper.columns([
    selectionHelper.accessor('tag', { id: 'tag', header: text('id'), size: 190 }),
    selectionHelper.accessor('zone', {
      id: 'zone',
      header: text('zone'),
      cell: ctx => text(ctx.getValue() === 'A' ? 'zoneA' : 'zoneB'),
    }),
    selectionHelper.accessor('pen', { id: 'pen', header: text('pen') }),
    selectionHelper.accessor('status', { id: 'status', header: text('status'), cell: ctx => text(ctx.getValue()) }),
    selectionHelper.accessor('weight', {
      id: 'weight',
      header: text('weight'),
      cell: ctx => number(ctx.getValue(), 1),
    }),
    selectionHelper.accessor('age', { id: 'age', header: text('age'), cell: ctx => number(ctx.getValue()) }),
    selectionHelper.accessor('note', {
      id: 'note',
      header: text('note'),
      size: 280,
      cell: ctx => <CellText value={text(ctx.getValue())} />,
    }),
    selectionHelper.display({ id: 'entered', header: text('entered'), cell: () => date('2026-03-12') }),
    selectionHelper.display({ id: 'owner', header: text('owner'), cell: () => text('person') }),
    selectionHelper.display({ id: 'updated', header: text('updated'), cell: () => date('2026-10-28') }),
    selectionHelper.display({
      id: 'actions',
      header: text('actions'),
      size: 160,
      cell: ctx => (
        <RowActions
          ownerKey={ctx.row.id}
          rowLabel={ctx.row.original.tag}
          actions={[
            { id: 'view', label: text('view'), onSelect: () => setViewed(ctx.row.original.tag) },
            {
              id: 'review',
              label: text('mark'),
              onSelect: () => setViewed(`${ctx.row.original.tag} · ${text('reviewed')}`),
            },
          ]}
        />
      ),
    }),
  ]);
  return (
    <Block id="layout" title={text('layout')} hint={text('layoutHint')}>
      <div className="flex flex-wrap gap-4">
        <Toggle checked={striped} onChange={setStriped}>
          {text('stripes')}
        </Toggle>
        <Toggle checked={bordered} onChange={setBordered}>
          {text('borders')}
        </Toggle>
        <Toggle checked={wrap} onChange={setWrap}>
          {text('wrap')}
        </Toggle>
      </div>
      {viewed && <p role="status">{viewed}</p>}
      <DataTable
        profile="selectable-list"
        model={{ kind: 'client', rows }}
        {...ready(rows)}
        columns={columns}
        labels={labels}
        getRowId={getRowId}
        caption={text('layout')}
        selectionLabels={selectionLabels}
        rowSelection={{ kind: 'internal' }}
        layout={{ stickyHeader: true, maxHeight: 360, striped, bordered, wrap: wrap ? ['note'] : false }}
        columnPinning={{ kind: 'internal', initial: { start: ['tag'], end: ['actions'] } }}
        columnAlign={{ weight: 'end', age: 'end', note: 'start' }}
      />
    </Block>
  );
}
function HeaderExample() {
  const { text, columns, labels, filters } = useDemo();
  const [manual, setManual] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const rows = manual
    ? seed.filter(row => (!values.zone || row.zone === values.zone) && (!values.status || row.status === values.status))
    : seed;
  const config: TableColumnFilters<DemoRow> = manual
    ? { ...filters, mode: 'manual', state: { kind: 'controlled', value: values, onChange: setValues } }
    : {
        ...filters,
        mode: 'local',
        matches: (row, id, value) => (id === 'zone' ? row.zone === value : row.status === value),
        state: { kind: 'controlled', value: values, onChange: setValues },
      };
  return (
    <Block id="header" title={text('header')} hint={text('headerHint')}>
      <Select
        label={text('filterMode')}
        value={manual ? 'manual' : 'local'}
        onValueChange={value => setManual(value === 'manual')}
        options={['local', 'manual'].map(value => ({ value, label: text(value) }))}
      />
      <DataTable
        profile="list"
        model={{ kind: 'client', rows }}
        {...ready(rows, seed.length)}
        columns={columns}
        labels={labels}
        getRowId={getRowId}
        caption={text('header')}
        columnFilters={config}
      />
    </Block>
  );
}
function ExpandExample() {
  const { text, columns, date, labels } = useDemo();
  return (
    <Block id="expand" title={text('expand')} hint={text('expandHint')}>
      <DataTable
        profile="list"
        model={{ kind: 'client', rows: seed }}
        {...ready(seed)}
        columns={columns}
        labels={labels}
        getRowId={getRowId}
        caption={text('expand')}
        details={{
          label: (row, expanded) => text(expanded ? 'collapseRow' : 'expandRow', { id: row.tag }),
          render: row => (
            <div className="grid gap-3">
              <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-3">
                <dt>{text('born')}</dt>
                <dd>{date('2025-02-26')}</dd>
                <dt>{text('breed')}</dt>
                <dd>{text('breedValue')}</dd>
              </dl>
              <table aria-label={`${row.tag} ${text('event')}`}>
                <thead>
                  <tr>
                    <th>{text('date')}</th>
                    <th>{text('event')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{date('2026-10-28')}</td>
                    <td>{text('eventValue')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        }}
      />
    </Block>
  );
}
function EditExample() {
  const { text, columns, labels } = useDemo();
  const [rows, setRows] = useState(seed);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  const newIds = useRef(new Set<string>());
  const nextId = useRef(0);
  return (
    <Block id="edit" title={text('edit')} hint={text('editHint')}>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          disabled={editingId !== null}
          onClick={() => {
            const id = `new-${++nextId.current}`;
            newIds.current.add(id);
            setRows(previous => [{ ...seed[0], id, tag: '', weight: 0 }, ...previous]);
            setEditingId(id);
          }}
        >
          {text('new')}
        </Button>
        <Toggle checked={fail} onChange={setFail}>
          {text('fail')}
        </Toggle>
      </div>
      <DataTable
        profile="list"
        model={{ kind: 'client', rows }}
        {...ready(rows)}
        columns={columns.filter(column => column.id !== 'note')}
        labels={labels}
        getRowId={getRowId}
        caption={text('edit')}
        editing={{
          ownerKey: 'synthetic-inline-edit',
          rowId: { kind: 'controlled', value: editingId, onChange: setEditingId },
          createDraft: row => ({ ...row }),
          labels: {
            edit: text('editing'),
            save: text('save'),
            cancel: text('cancel'),
            saving: text('saving'),
            failed: text('saveFailed'),
            actions: text('actions'),
          },
          renderCell: ({ columnId, draft, setDraft, error, disabled }) =>
            ['tag', 'pen', 'weight', 'status'].includes(columnId) ? (
              <div className="grid gap-1">
                {columnId === 'weight' ? (
                  <NumberInput
                    aria-label={text('weight')}
                    value={draft.weight}
                    disabled={disabled}
                    aria-invalid={!!error}
                    onValueChange={value => setDraft({ ...draft, weight: value ?? 0 })}
                  />
                ) : columnId === 'status' ? (
                  <Select
                    label={text('status')}
                    value={draft.status}
                    disabled={disabled}
                    onValueChange={value => {
                      if (value === 'normal' || value === 'pending' || value === 'reviewed')
                        setDraft({ ...draft, status: value });
                    }}
                    options={['normal', 'pending', 'reviewed'].map(value => ({ value, label: text(value) }))}
                  />
                ) : (
                  <Input
                    aria-label={text(columnId === 'tag' ? 'id' : columnId)}
                    value={columnId === 'tag' ? draft.tag : draft.pen}
                    disabled={disabled}
                    aria-invalid={!!error}
                    onChange={event =>
                      setDraft(
                        columnId === 'tag'
                          ? { ...draft, tag: event.target.value }
                          : { ...draft, pen: event.target.value },
                      )
                    }
                  />
                )}
                {error && (
                  <span role="alert" className="text-destructive-text">
                    ⚠ {error}
                  </span>
                )}
              </div>
            ) : null,
          validate: draft => {
            const errors: Record<string, string> = {};
            if (!draft.tag.trim()) errors.tag = text('required');
            if (!draft.pen.trim()) errors.pen = text('required');
            if (!(draft.weight > 0)) errors.weight = text('invalidWeight');
            return errors;
          },
          onSave: async (draft, { signal }) => {
            await saveDemo(signal, fail);
            setRows(previous => previous.map(row => (row.id === draft.id ? draft : row)));
            newIds.current.delete(draft.id);
          },
          onCancel: row => {
            if (newIds.current.delete(row.id)) setRows(previous => previous.filter(item => item.id !== row.id));
          },
        }}
      />
    </Block>
  );
}
function MergeExample() {
  const { text, number, labels, filters } = useDemo();
  const [horizontal, setHorizontal] = useState(false);
  const merge = mergeConsecutiveRows<DemoRow>('zone', row => row.zone);
  const columns = helper.columns([
    helper.accessor('zone', {
      id: 'zone',
      header: text('zone'),
      cell: ctx => text(ctx.getValue() === 'A' ? 'zoneA' : 'zoneB'),
    }),
    helper.accessor('pen', { id: 'pen', header: text('pen') }),
    helper.accessor('count', { id: 'count', header: text('count'), cell: ctx => number(ctx.getValue()) }),
    helper.accessor('weight', {
      id: 'weight',
      header: text('averageWeight'),
      cell: ctx => number(ctx.getValue(), 1),
    }),
  ]);
  return (
    <Block id="merge" title={text('merge')} hint={text('mergeHint')}>
      <Toggle checked={horizontal} onChange={setHorizontal}>
        {text('mergeHorizontal')}
      </Toggle>
      <DataTable
        profile="list"
        model={{ kind: 'client', rows: seed }}
        {...ready(seed)}
        columns={columns}
        labels={labels}
        getRowId={getRowId}
        caption={text('merge')}
        columnAlign={{ count: 'end', weight: 'end' }}
        columnFilters={{ ...filters, fields: { zone: filters.fields.zone } }}
        layout={{ bordered: true }}
        cellSpan={context =>
          horizontal && context.rowIndex === 0 && context.columnId === 'zone' ? { colSpan: 2 } : merge(context)
        }
        summary={{
          label: text('total'),
          colSpan: (id, ids) => (id === 'zone' && ids[1] === 'pen' ? 2 : 1),
          renderCell: (id, rows) =>
            id === 'zone'
              ? text('total')
              : id === 'pen'
                ? text('total')
                : id === 'count'
                  ? number(rows.reduce((sum, row) => sum + row.count, 0))
                  : rows.length
                    ? `${text('weightedAverage')}: ${number(
                        rows.reduce((sum, row) => sum + row.weight * row.count, 0) /
                          rows.reduce((sum, row) => sum + row.count, 0),
                        1,
                      )}`
                    : '—',
        }}
      />
    </Block>
  );
}
function DragExample() {
  const { text, columns, labels, filters } = useDemo();
  const [rows, setRows] = useState(seed),
    [sorting, setSorting] = useState<SortingState>([]);
  const [fail, setFail] = useState(false),
    [paginate, setPaginate] = useState(false),
    [saved, setSaved] = useState(false);
  return (
    <Block id="drag" title={text('drag')} hint={text('dragHint')}>
      <div className="flex flex-wrap items-center gap-4">
        <Toggle checked={fail} onChange={setFail}>
          {text('fail')}
        </Toggle>
        <Toggle checked={paginate} onChange={setPaginate}>
          {text('pageMode')}
        </Toggle>
        <Button type="button" variant="outline" onClick={() => setSorting([])}>
          {text('resetSort')}
        </Button>
      </div>
      {saved && <p role="status">{text('orderSaved')}</p>}
      <DataTable
        profile="list"
        model={{ kind: 'client', rows }}
        {...ready(rows)}
        columns={columns.filter(column => column.id !== 'note')}
        labels={labels}
        getRowId={getRowId}
        caption={text('drag')}
        columnFilters={filters}
        sorting={{ kind: 'controlled', value: sorting, onChange: setSorting }}
        pagination={{ kind: 'controlled', value: { pageIndex: 0, pageSize: paginate ? 2 : 25 }, onChange: () => {} }}
        reorder={{
          labels: {
            handle: row => text('move', { id: row.tag }),
            disabled: text('reorderDisabled'),
            pickedUp: text('picked'),
            saving: text('saving'),
            failed: text('orderFailed'),
          },
          onReorder: async (ids, { signal }) => {
            await saveDemo(signal, fail);
            setRows(previous => ids.map(id => previous.find(row => row.id === id)!));
            setSaved(true);
          },
        }}
      />
    </Block>
  );
}
type PreviewState = 'ready' | 'initial' | 'refresh' | 'refreshError' | 'error' | 'empty' | 'noResults';
function StatesExample() {
  const { text, columns, labels } = useDemo();
  const [state, setState] = useState<PreviewState>('ready');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const choose = (value: PreviewState) => {
    pending.current?.abort();
    setState(value);
    if (value !== 'initial' && value !== 'refresh') return;
    const controller = new AbortController();
    pending.current = controller;
    void saveDemo(controller.signal).then(
      () => {
        if (!controller.signal.aborted) setState('ready');
      },
      () => {},
    );
  };
  const hasRows = state === 'ready' || state === 'refresh' || state === 'refreshError';
  const rows = hasRows ? seed : [];
  const metadata: TableReadMetadata =
    state === 'initial' || state === 'error'
      ? { readState: state === 'initial' ? 'pending' : 'error', sourceCount: null, resultCount: null }
      : ready(rows, state === 'empty' ? 0 : seed.length);
  return (
    <Block id="states" title={text('states')} hint={text('statesHint')}>
      <div className="flex flex-wrap gap-3">
        <Select
          label={text('state')}
          value={state}
          onValueChange={value => choose(value as PreviewState)}
          options={(['ready', 'initial', 'refresh', 'refreshError', 'error', 'empty', 'noResults'] as const).map(
            value => ({ value, label: text(value) }),
          )}
        />
        <Button type="button" variant="outline" onClick={() => choose('refresh')}>
          {text('reload')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{text('rowPageSize')}</p>
      <DataTable
        profile="list"
        model={{ kind: 'client', rows }}
        {...metadata}
        columns={columns}
        labels={{ ...labels, pending: text('loading'), error: text('readFailed') }}
        getRowId={getRowId}
        caption={text('states')}
        statePresentation="feedback"
        pagination={{ kind: 'internal', initial: { pageIndex: 0, pageSize: 5 } }}
        refresh={state === 'refresh' ? 'pending' : state === 'refreshError' ? 'error' : undefined}
        emptyAction={
          state === 'error' || state === 'refreshError' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => choose(state === 'refreshError' ? 'refresh' : 'initial')}
            >
              {text('retry')}
            </Button>
          ) : state === 'noResults' ? (
            <Button type="button" variant="outline" onClick={() => choose('ready')}>
              {text('clearFilters')}
            </Button>
          ) : undefined
        }
      />
    </Block>
  );
}
