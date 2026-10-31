import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import {
  DataTable,
  RowActions,
  CellText,
  createDataTableLabels,
  createSelectableColumnHelper,
  type RowSelectionState,
  type TableTranslator,
} from '@niubu/common-ui/data-table';
import { useSchemaForm } from '@niubu/common-ui/form';
import { FormFrame } from '@niubu/common-ui/form-frame';
import { usePreviewAppearance } from '../usePreviewAppearance';
import { formatQuantity } from '@niubu/locales';
import { useTranslation } from '@niubu/locales/react';
import { Badge, type BadgeProps } from '@niubu/shadcn-ui/badge';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { Select } from '@niubu/shadcn-ui/select';
import { BusinessPortalBoundary } from '@niubu/shadcn-ui/business-portal-boundary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@niubu/shadcn-ui/dialog';
import { completeListCopy } from './complete-list-copy';

const initialStatuses = ['active', 'quarantine', 'moving', 'alert', 'departed'] as const;
const statuses = [...initialStatuses, 'disabled'] as const;
const pens = ['a', 'b', 'c'] as const;
type Status = (typeof statuses)[number];
type Pen = (typeof pens)[number];
type AnimalValues = { tag: string; pen: Pen; status: Status; weight: number; age: number; note: string };
type Animal = AnimalValues & { id: string };
type Panel =
  { kind: 'create' } | { kind: 'view' | 'edit' | 'delete' | 'disable'; row: Animal } | { kind: 'move'; ids: string[] };
const getRowId = (row: Animal) => row.id;
const helper = createSelectableColumnHelper<Animal>();
const tones: Record<Status, BadgeProps['variant']> = {
  active: 'success',
  quarantine: 'warning',
  moving: 'info',
  alert: 'danger',
  departed: 'neutral',
  disabled: 'neutral',
};
const seedRows = (): Animal[] =>
  Array.from({ length: 128 }, (_, i) => ({
    id: `animal-${i}`,
    tag: `CN-2026-${String(418 + i * 3).padStart(4, '0')}`,
    pen: pens[Math.floor(i / 2) % pens.length],
    status: initialStatuses[i % initialStatuses.length],
    weight: [486.5, 352, 418.2, 301.7, 545][i % 5],
    age: [612, 401, 520, 355, 730][i % 5],
    note: '',
  }));
function filterAnimals(rows: readonly Animal[], query: { tag: string; pen: string; status: string }) {
  return rows.filter(
    row =>
      row.tag.toLowerCase().includes(query.tag.trim().toLowerCase()) &&
      (query.pen === 'all' || row.pen === query.pen) &&
      (query.status === 'all' || row.status === query.status),
  );
}

const ActionsContext = createContext<((panel: Panel) => void) | null>(null);
function AnimalActions({ row }: { row: Animal }) {
  const open = useContext(ActionsContext);
  const { t } = useTranslation('app', completeListCopy);
  if (!open) return null;
  return (
    <RowActions
      rowLabel={row.tag}
      ownerKey={`complete-list:${row.id}`}
      actions={[
        {
          id: 'view',
          label: t('examples.completeList.view'),
          disabled: row.status === 'departed' || row.status === 'disabled',
          onSelect: () => open({ kind: 'view', row }),
        },
        { id: 'edit', label: t('examples.completeList.edit'), onSelect: () => open({ kind: 'edit', row }) },
        {
          id: 'move',
          label: t('examples.completeList.move'),
          disabled: row.status === 'quarantine' || row.status === 'departed' || row.status === 'disabled',
          onSelect: () => open({ kind: 'move', ids: [row.id] }),
        },
        {
          id: 'disable',
          label: t('examples.completeList.disable'),
          destructive: true,
          disabled: row.status === 'departed' || row.status === 'disabled',
          onSelect: () => open({ kind: 'disable', row }),
        },
        {
          id: 'delete',
          label: t('examples.completeList.delete'),
          destructive: true,
          onSelect: () => open({ kind: 'delete', row }),
        },
      ]}
    />
  );
}

export function CompleteListPage() {
  const { t, locale } = useTranslation('app', completeListCopy);
  const [rows, setRows] = useState(seedRows);
  const [appearance, setAppearance] = useState('global');
  const [state, setState] = useState('ready');
  const [draft, setDraft] = useState({ tag: '', pen: 'all', status: 'all' });
  const [query, setQuery] = useState(draft);
  const [selection, setSelection] = useState<RowSelectionState>({ 'animal-0': true });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 5 });
  const [panel, setPanel] = useState<Panel | null>(null);
  const [destination, setDestination] = useState<Pen>('a');
  const [feedback, setFeedback] = useState('');
  const cancelEditor = useRef<(() => void) | null>(null);
  const bindCancel = useCallback((cancel: (() => void) | null) => {
    cancelEditor.current = cancel;
  }, []);
  const nextId = useRef(128);
  const filterId = useId();
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (reloadTimer.current !== null) clearTimeout(reloadTimer.current);
    },
    [],
  );
  const mode = appearance === 'global' ? 'global' : appearance.startsWith('dark') ? 'dark' : 'light';
  const density = appearance === 'global' ? 'global' : appearance.endsWith('compact') ? 'compact' : 'standard';
  const preview = usePreviewAppearance(mode, density);
  const filtered = useMemo(() => filterAnimals(rows, query), [rows, query]);
  const number = useCallback(
    (value: number, precision: number) =>
      formatQuantity(
        { value, unit: '', quality: 'known' },
        { locale, precision, labels: { missing: '—', unknown: '—' } },
      ),
    [locale],
  );
  const headers = useMemo(
    () =>
      Object.fromEntries(
        ['tag', 'pen', 'status', 'weight', 'age', 'note', 'actions'].map(key => [
          key,
          t(`examples.completeList.${key}`),
        ]),
      ),
    [t],
  );
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('tag', { id: 'tag', header: headers.tag, size: 180 }),
        helper.accessor('pen', {
          id: 'pen',
          header: headers.pen,
          size: 140,
          cell: ctx => t(`examples.completeList.pen.${ctx.getValue()}`),
        }),
        helper.accessor('status', {
          id: 'status',
          header: headers.status,
          size: 120,
          cell: ctx => (
            <Badge variant={tones[ctx.getValue()]}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {t(`examples.completeList.status.${ctx.getValue()}`)}
            </Badge>
          ),
        }),
        helper.accessor('weight', {
          id: 'weight',
          header: headers.weight,
          size: 120,
          cell: ctx => number(ctx.getValue(), 1),
        }),
        helper.accessor('age', { id: 'age', header: headers.age, size: 100, cell: ctx => number(ctx.getValue(), 0) }),
        helper.accessor('note', {
          id: 'note',
          header: headers.note,
          size: 260,
          cell: ctx => (
            <CellText value={ctx.getValue() || t(`examples.completeList.note.${ctx.row.original.status}`)} />
          ),
        }),
        helper.display({
          id: 'actions',
          header: headers.actions,
          size: 120,
          cell: ctx => <AnimalActions row={ctx.row.original} />,
        }),
      ]),
    [headers, t, number],
  );
  const chosen = rows.filter(row => selection[row.id]);
  const movable = chosen.filter(
    row => row.status !== 'quarantine' && row.status !== 'departed' && row.status !== 'disabled',
  );
  const displayRows = state === 'ready' ? filtered : [];
  const ready = state === 'ready' || state === 'empty';
  const closePanel = () => {
    if (panel?.kind === 'create' || panel?.kind === 'edit') cancelEditor.current?.();
    else setPanel(null);
  };
  const readState = ready
    ? { readState: 'ready' as const, sourceCount: rows.length, resultCount: displayRows.length }
    : {
        readState: state === 'pending' ? ('pending' as const) : ('error' as const),
        sourceCount: null,
        resultCount: null,
      };
  function changeReadState(value: string) {
    if (reloadTimer.current !== null) clearTimeout(reloadTimer.current);
    setState(value);
  }
  function reload() {
    changeReadState('pending');
    reloadTimer.current = setTimeout(() => setState('ready'), 650);
  }
  function apply(reset: boolean) {
    const next = reset ? { tag: '', pen: 'all', status: 'all' } : draft;
    if (reset) setDraft(next);
    setQuery(next);
    setSelection({});
    setPagination(previous => ({ ...previous, pageIndex: 0 }));
    changeReadState('ready');
  }
  function commitRows(nextRows: Animal[]) {
    const resultCount = filterAnimals(nextRows, query).length;
    setRows(nextRows);
    setPagination(previous => ({
      ...previous,
      pageIndex: Math.min(previous.pageIndex, Math.max(0, Math.ceil(resultCount / previous.pageSize) - 1)),
    }));
  }
  function save(input: AnimalValues) {
    const values = { ...input, tag: input.tag.trim() };
    if (panel?.kind === 'edit') commitRows(rows.map(row => (row.id === panel.row.id ? { ...row, ...values } : row)));
    else {
      const id = `animal-${nextId.current++}`;
      setRows(previous => [{ ...values, id }, ...previous]);
      setDraft({ tag: '', pen: 'all', status: 'all' });
      setQuery({ tag: '', pen: 'all', status: 'all' });
      setPagination(previous => ({ ...previous, pageIndex: 0 }));
    }
    changeReadState('ready');
    setFeedback(t('examples.completeList.saved'));
    setPanel(null);
  }
  function remove(row: Animal) {
    commitRows(rows.filter(item => item.id !== row.id));
    setSelection(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => id !== row.id)));
    setPanel(null);
    setFeedback(t('examples.completeList.deleted'));
  }
  function exportSelected() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(chosen, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'synthetic-animal-records.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setFeedback(t('examples.completeList.exported'));
  }
  const title =
    panel?.kind === 'create'
      ? t('examples.completeList.create')
      : panel?.kind === 'edit'
        ? t('examples.completeList.edit')
        : panel?.kind === 'disable'
          ? t('examples.completeList.disableTitle')
          : panel?.kind === 'delete'
            ? t('examples.completeList.deleteTitle')
            : panel?.kind === 'move'
              ? t('examples.completeList.moveTitle')
              : t('examples.completeList.detail');
  return (
    <div
      className="grid min-w-0 gap-[var(--workspace-section-gap)] bg-background p-[var(--workspace-card-padding)] text-foreground"
      style={preview.style}
      data-preview-surface
      data-theme={preview.theme}
      data-density={preview.density}
    >
      <BusinessPortalBoundary locked={false}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            {t('examples.completeList.appearance')}
            <Select
              label={t('examples.completeList.appearance')}
              value={appearance}
              onValueChange={setAppearance}
              options={[
                { value: 'global', label: t('examples.completeList.followGlobal') },
                { value: 'light-standard', label: t('examples.completeList.lightStandard') },
                { value: 'light-compact', label: t('examples.completeList.lightCompact') },
                { value: 'dark-standard', label: t('examples.completeList.darkStandard') },
                { value: 'dark-compact', label: t('examples.completeList.darkCompact') },
              ]}
            />
          </label>
          <label className="grid gap-1 text-sm">
            {t('examples.completeList.readState')}
            <Select
              label={t('examples.completeList.readState')}
              value={state}
              onValueChange={changeReadState}
              options={['ready', 'pending', 'error', 'empty'].map(value => ({
                value,
                label: t(`examples.completeList.${value}`),
              }))}
            />
          </label>
          <p className="text-sm text-muted-foreground">{t('examples.completeList.synthetic')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[length:var(--heading-1-font-size)] leading-[var(--heading-1-line-height)] font-semibold">
            {t('examples.completeList.title')}
          </h1>
          <Button onClick={() => setPanel({ kind: 'create' })}>{t('examples.completeList.create')}</Button>
        </div>
        <form
          className="flex flex-wrap items-end gap-[var(--workspace-control-height)] rounded-lg border border-border bg-card p-[var(--workspace-card-padding)]"
          onSubmit={event => {
            event.preventDefault();
            apply(false);
          }}
        >
          <label className="grid gap-2 text-sm" htmlFor={`${filterId}-tag`}>
            {t('examples.completeList.tag')}
            <Input
              id={`${filterId}-tag`}
              value={draft.tag}
              placeholder={t('examples.completeList.tagPlaceholder')}
              onChange={event => setDraft(previous => ({ ...previous, tag: event.target.value }))}
            />
          </label>
          <label className="grid gap-2 text-sm">
            {t('examples.completeList.pen')}
            <Select
              label={t('examples.completeList.pen')}
              value={draft.pen}
              onValueChange={pen => setDraft(previous => ({ ...previous, pen }))}
              options={[
                { value: 'all', label: t('examples.completeList.all') },
                ...pens.map(value => ({ value, label: t(`examples.completeList.pen.${value}`) })),
              ]}
            />
          </label>
          <label className="grid gap-2 text-sm">
            {t('examples.completeList.status')}
            <Select
              label={t('examples.completeList.status')}
              value={draft.status}
              onValueChange={status => setDraft(previous => ({ ...previous, status }))}
              options={[
                { value: 'all', label: t('examples.completeList.all') },
                ...statuses.map(value => ({ value, label: t(`examples.completeList.status.${value}`) })),
              ]}
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit">{t('examples.completeList.query')}</Button>
            <Button type="button" variant="outline" onClick={() => apply(true)}>
              {t('examples.completeList.reset')}
            </Button>
          </div>
        </form>
        <ActionsContext value={setPanel}>
          <DataTable
            profile="selectable-list"
            caption={t('examples.completeList.title')}
            columns={columns}
            model={{ kind: 'client', rows: displayRows }}
            getRowId={getRowId}
            {...readState}
            labels={createDataTableLabels(t, headers)}
            statePresentation="feedback"
            columnAlign={{ tag: 'start', weight: 'end', age: 'end', note: 'start' }}
            pagination={{ kind: 'controlled', value: pagination, onChange: setPagination }}
            rowSelection={{ kind: 'controlled', value: selection, onChange: setSelection }}
            toolbar={{
              title: (
                <span className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={!movable.length || !ready}
                    onClick={() => setPanel({ kind: 'move', ids: movable.map(row => row.id) })}
                  >
                    {t('examples.completeList.batchMove')}
                  </Button>
                  <Button variant="outline" disabled={!chosen.length || !ready} onClick={exportSelected}>
                    {t('examples.completeList.export')}
                  </Button>
                </span>
              ),
              onRefresh: reload,
              allowMaximize: true,
            }}
            selectionLabels={{
              selectPage: t('common:table.selectPage'),
              selectRow: id => t('common:table.selectRow', { id }),
              selected: count => t('common:table.selected', { count }),
              selectAllResults: count => t('common:table.selectAllResults', { count }),
              clearSelection: t('common:table.clearSelection'),
              allResultsUnavailable: t('common:table.allResultsUnavailable'),
            }}
            emptyAction={
              <Button variant="outline" onClick={() => (state === 'error' ? reload() : apply(true))}>
                {t(state === 'error' ? 'examples.completeList.retry' : 'examples.completeList.reset')}
              </Button>
            }
          />
        </ActionsContext>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {feedback}
        </p>
        <Dialog
          open={panel !== null}
          onOpenChange={open => {
            if (!open) closePanel();
          }}
        >
          {panel && (
            <DialogContent
              closeLabel={t('examples.completeList.close')}
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
            >
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  {panel.kind === 'disable'
                    ? t('examples.completeList.disableDescription', { tag: panel.row.tag })
                    : panel.kind === 'delete'
                      ? t('examples.completeList.deleteDescription', { tag: panel.row.tag })
                      : t('examples.completeList.synthetic')}
                </DialogDescription>
              </DialogHeader>
              {panel.kind === 'create' || panel.kind === 'edit' ? (
                <AnimalEditor
                  key={panel.kind === 'edit' ? panel.row.id : 'new'}
                  record={panel.kind === 'edit' ? panel.row : undefined}
                  rows={rows}
                  onSave={save}
                  onCancel={() => setPanel(null)}
                  onCancelReady={bindCancel}
                />
              ) : panel.kind === 'view' ? (
                <dl className="grid grid-cols-2 gap-3 p-6">
                  {['tag', 'pen', 'status', 'weight', 'age', 'note'].map(key => (
                    <div key={key}>
                      <dt className="text-sm text-muted-foreground">{headers[key]}</dt>
                      <dd>
                        {key === 'pen'
                          ? t(`examples.completeList.pen.${panel.row.pen}`)
                          : key === 'status'
                            ? t(`examples.completeList.status.${panel.row.status}`)
                            : key === 'weight'
                              ? number(panel.row.weight, 1)
                              : key === 'age'
                                ? number(panel.row.age, 0)
                                : key === 'tag'
                                  ? panel.row.tag
                                  : panel.row.note || t(`examples.completeList.note.${panel.row.status}`)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : panel.kind === 'move' ? (
                <div className="p-6">
                  <Select
                    label={t('examples.completeList.pen')}
                    value={destination}
                    onValueChange={value => setDestination(pens.find(pen => pen === value) ?? 'a')}
                    options={pens.map(value => ({ value, label: t(`examples.completeList.pen.${value}`) }))}
                  />
                </div>
              ) : null}
              {panel.kind !== 'create' && panel.kind !== 'edit' && (
                <DialogFooter className="p-4">
                  <Button variant="outline" onClick={closePanel}>
                    {t('examples.completeList.close')}
                  </Button>
                  {panel.kind === 'disable' && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        commitRows(rows.map(row => (row.id === panel.row.id ? { ...row, status: 'disabled' } : row)));
                        setSelection(previous =>
                          Object.fromEntries(Object.entries(previous).filter(([id]) => id !== panel.row.id)),
                        );
                        setFeedback(t('examples.completeList.disabled'));
                        setPanel(null);
                      }}
                    >
                      {t('examples.completeList.disable')}
                    </Button>
                  )}
                  {panel.kind === 'delete' && (
                    <Button variant="destructive" onClick={() => remove(panel.row)}>
                      {t('examples.completeList.delete')}
                    </Button>
                  )}
                  {panel.kind === 'move' && (
                    <Button
                      onClick={() => {
                        commitRows(
                          rows.map(row =>
                            panel.ids.includes(row.id) ? { ...row, pen: destination, status: 'active' } : row,
                          ),
                        );
                        setPanel(null);
                        setSelection({});
                        setFeedback(t('examples.completeList.moved'));
                      }}
                    >
                      {t('examples.completeList.save')}
                    </Button>
                  )}
                </DialogFooter>
              )}
            </DialogContent>
          )}
        </Dialog>
      </BusinessPortalBoundary>
    </div>
  );
}

function AnimalEditor({
  record,
  rows,
  onSave,
  onCancel,
  onCancelReady,
}: {
  record?: Animal;
  rows: readonly Animal[];
  onSave: (values: AnimalValues) => void;
  onCancel: () => void;
  onCancelReady: (cancel: (() => void) | null) => void;
}) {
  const { t } = useTranslation('app', completeListCopy);
  const saved = useRef<AnimalValues | null>(null);
  const title = t(record ? 'examples.completeList.edit' : 'examples.completeList.create');
  const fields = useMemo(() => editorFields(t, rows, record?.id), [t, rows, record?.id]);
  const schema = useSchemaForm<AnimalValues>({
    fields,
    defaultValues: record ?? { tag: '', pen: 'a', status: 'active', weight: 0, age: 0, note: '' },
  });
  const { updateFields } = schema;
  useEffect(() => updateFields(fields), [fields, updateFields]);
  return (
    <div className="p-[var(--workspace-card-padding)]">
      <FormFrame
        form={schema.form}
        title={title}
        headerMode="external"
        description={null}
        scopeKey="synthetic:complete-list"
        draftKey={record?.id ?? 'new'}
        draftFilter={schema.filterDraft}
        onCancel={onCancel}
        onCancelReady={onCancelReady}
        allowDiscard
        submitLabel={t('examples.completeList.save')}
        onSubmit={async (values, { signal }) => {
          if (!signal.aborted) saved.current = values;
        }}
        onSubmitted={() => {
          if (saved.current) onSave(saved.current);
        }}
      >
        <schema.Fields />
      </FormFrame>
    </div>
  );
}
function editorFields(t: TableTranslator, rows: readonly Animal[], editingId?: string) {
  const invalidNumber = t('examples.completeList.invalidNumber');
  return [
    {
      name: 'tag' as const,
      kind: 'text' as const,
      label: t('examples.completeList.tag'),
      required: true,
      schema: z
        .string()
        .min(1, t('examples.completeList.invalidTag'))
        .max(40, t('examples.completeList.invalidTag'))
        .refine(
          value =>
            !!value.trim() &&
            !rows.some(row => row.id !== editingId && row.tag.toLowerCase() === value.trim().toLowerCase()),
          t('examples.completeList.invalidTag'),
        ),
    },
    {
      name: 'pen' as const,
      kind: 'select' as const,
      label: t('examples.completeList.pen'),
      componentProps: { options: pens.map(value => ({ value, label: t(`examples.completeList.pen.${value}`) })) },
      schema: z.enum(pens),
    },
    {
      name: 'status' as const,
      kind: 'select' as const,
      label: t('examples.completeList.status'),
      componentProps: {
        options: statuses.map(value => ({ value, label: t(`examples.completeList.status.${value}`) })),
      },
      schema: z.enum(statuses),
    },
    {
      name: 'weight' as const,
      kind: 'number' as const,
      label: t('examples.completeList.weight'),
      componentProps: { min: 0, step: 0.1 },
      schema: z.number({ error: invalidNumber }).min(0, invalidNumber),
    },
    {
      name: 'age' as const,
      kind: 'number' as const,
      label: t('examples.completeList.age'),
      componentProps: { min: 0, step: 1 },
      schema: z.number({ error: invalidNumber }).int(invalidNumber).min(0, invalidNumber),
    },
    {
      name: 'note' as const,
      kind: 'textarea' as const,
      label: t('examples.completeList.note'),
      schema: z.string().max(500, t('examples.completeList.invalidNote')),
    },
  ];
}
