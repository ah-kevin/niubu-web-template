import { DocumentationLink } from '../DocumentationLink';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DataTable,
  createDataTableLabels,
  createReadColumnHelper,
  createListColumnHelper,
  createSelectableColumnHelper,
  useQueryDataTable,
  useTablePreferences,
  type TableTranslator,
} from '@niubu/common-ui/data-table';
import { useTranslation } from '@niubu/locales/react';
import { createPreferenceManager, PreferenceProvider } from '@niubu/preferences';
import { Button } from '@niubu/shadcn-ui/button';
import { Select } from '@niubu/shadcn-ui/select';
import { tablesCopy } from './copy';
import {
  loadSyntheticTablePage,
  syntheticRows,
  type SyntheticRow,
  type SyntheticTableLoader,
} from './synthetic-fixture';
export type { SyntheticRow, SyntheticTableLoader } from './synthetic-fixture';

const columnIds = ['name', 'score', 'active'];
const getRowId = (row: SyntheticRow) => row.id;
const readHelper = createReadColumnHelper<SyntheticRow>();
const listHelper = createListColumnHelper<SyntheticRow>();
const selectableHelper = createSelectableColumnHelper<SyntheticRow>();
const clientModel = { kind: 'client' as const, rows: syntheticRows };
const clientRead = { readState: 'ready' as const, sourceCount: 4, resultCount: 4 };

function useColumns(t: TableTranslator) {
  return useMemo(() => {
    const headers = {
      name: t('examples.tables.name'),
      score: t('examples.tables.score'),
      active: t('examples.tables.active'),
    };
    const activeCell = (value: boolean) => (
      <span>{t(value ? 'examples.tables.enabled' : 'examples.tables.disabled')}</span>
    );
    return {
      labels: createDataTableLabels(t, headers),
      read: readHelper.columns([
        readHelper.accessor('name', { id: 'name', header: headers.name }),
        readHelper.accessor('score', { id: 'score', header: headers.score }),
      ]),
      list: listHelper.columns([
        listHelper.accessor('name', { id: 'name', header: headers.name, sortDescFirst: false }),
        listHelper.accessor('score', { id: 'score', header: headers.score, sortDescFirst: false }),
        listHelper.accessor('active', {
          id: 'active',
          header: headers.active,
          enableSorting: false,
          cell: context => activeCell(context.getValue()),
        }),
      ]),
      selectable: selectableHelper.columns([
        selectableHelper.accessor('name', { id: 'name', header: headers.name, sortDescFirst: false }),
        selectableHelper.accessor('score', { id: 'score', header: headers.score, sortDescFirst: false }),
        selectableHelper.accessor('active', {
          id: 'active',
          header: headers.active,
          enableSorting: false,
          cell: context => activeCell(context.getValue()),
        }),
      ]),
    };
  }, [t]);
}

/** Optional synthetic loader port lets component tests deliver out-of-order replies without HTTP. */
export function TablesPage({ load = loadSyntheticTablePage }: { load?: SyntheticTableLoader } = {}): React.JSX.Element {
  const { t } = useTranslation('app', tablesCopy);
  const [scope, setScope] = useState('north');
  const [preferences] = useState(() => {
    const values = new Map<string, string>();
    const manager = createPreferenceManager({
      identity: {
        storageNamespace: 'playground-table-example',
        product: 'Template Playground',
        appId: 'table-fixture',
        environment: 'synthetic',
        identityKey: 'synthetic-viewer',
      },
      storage: {
        read: key => ({ ok: true, value: values.get(key) ?? null }),
        write: (key, value) => {
          values.set(key, value);
          return { ok: true };
        },
      },
    });
    return {
      manager,
      dispose: () => {
        manager.dispose();
        values.clear();
      },
    };
  });
  const lifetime = useRef(0);
  useEffect(() => {
    const current = ++lifetime.current;
    const isCurrent = () => lifetime.current === current;
    return () => {
      // StrictMode replays setup synchronously. Release a real unmount after child subscriptions retire.
      queueMicrotask(() => {
        if (isCurrent()) preferences.dispose();
      });
    };
  }, [preferences]);
  return (
    <section className="mx-auto w-full max-w-[82rem] min-w-0 space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">{t('examples.tables.title')}</h1>
        <DocumentationLink kind="tables" />
        <p className="max-w-[90ch] text-sm leading-relaxed text-muted-foreground">{t('examples.tables.synthetic')}</p>
        <p className="max-w-[90ch] text-sm leading-relaxed text-muted-foreground">{t('examples.tables.boundary')}</p>
      </header>
      <label className="grid w-fit max-w-full gap-2 text-sm font-medium">
        {t('examples.tables.scope')}
        <Select
          label={t('examples.tables.scope')}
          value={scope}
          onValueChange={setScope}
          options={[
            { value: 'north', label: t('examples.tables.north') },
            { value: 'south', label: t('examples.tables.south') },
          ]}
        />
      </label>
      <PreferenceProvider manager={preferences.manager}>
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
          <ClientExamples key={scope} scope={scope} t={t} />
          <ServerExample scope={scope} load={load} t={t} />
        </div>
      </PreferenceProvider>
    </section>
  );
}

function ExampleGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[40rem] min-w-0 space-y-3 [&_caption]:sr-only">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function ClientExamples({ scope, t }: { scope: string; t: TableTranslator }) {
  const columns = useColumns(t);
  const preferences = useTablePreferences({
    storageNamespace: 'playground-table-example',
    tableId: 'selectable-demo',
    columnIds,
    scopeKey: `synthetic:${scope}`,
  });
  return (
    <>
      <ExampleGroup title={t('examples.tables.read')}>
        <DataTable
          profile="read"
          model={clientModel}
          {...clientRead}
          getRowId={getRowId}
          columns={columns.read}
          caption={t('examples.tables.read')}
          labels={columns.labels}
        />
      </ExampleGroup>
      <ExampleGroup title={t('examples.tables.list')}>
        <DataTable
          profile="list"
          model={clientModel}
          {...clientRead}
          getRowId={getRowId}
          columns={columns.list}
          caption={t('examples.tables.list')}
          labels={columns.labels}
          pagination={{ kind: 'internal', initial: { pageIndex: 0, pageSize: 2 } }}
        />
      </ExampleGroup>
      <ExampleGroup title={t('examples.tables.client')}>
        <DataTable
          profile="selectable-list"
          model={clientModel}
          {...clientRead}
          getRowId={getRowId}
          columns={columns.selectable}
          caption={t('examples.tables.client')}
          labels={columns.labels}
          pagination={{ kind: 'internal', initial: { pageIndex: 0, pageSize: 2 } }}
          rowSelection={{ kind: 'internal' }}
          {...preferences}
          selectionLabels={{
            selectPage: t('common:table.selectPage'),
            selectRow: id => t('common:table.selectRow', { id }),
            selected: count => t('common:table.selected', { count }),
            selectAllResults: count => t('common:table.selectAllResults', { count }),
            clearSelection: t('common:table.clearSelection'),
            allResultsUnavailable: t('common:table.allResultsUnavailable'),
          }}
        />
      </ExampleGroup>
    </>
  );
}

function ServerExample({ scope, load, t }: { scope: string; load: SyntheticTableLoader; t: TableTranslator }) {
  const columns = useColumns(t);
  const table = useQueryDataTable<{ term: string }, { term: string }, SyntheticRow>({
    queryForm: {
      fields: [{ name: 'term', kind: 'text', label: t('examples.tables.term') }],
      defaultValues: { term: '' },
      transform: values => ({ term: (values.term ?? '').trim() }),
    },
    scopeKey: `synthetic:tables:${scope}`,
    enabled: true,
    initialPageSize: 2,
    load: request => load(request, scope),
  });
  const { updateFields } = table.queryForm;
  useEffect(() => {
    updateFields([{ name: 'term', label: t('examples.tables.term') }]);
  }, [t, updateFields]);
  return (
    <ExampleGroup title={t('examples.tables.server')}>
      <div className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-[var(--workspace-card-padding)]">
        <table.queryForm.Form
          className="playground-tables-query min-w-0"
          submitLabel={t('examples.tables.query')}
          resetLabel={t('examples.tables.reset')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void table.reload()}>
            {t('examples.tables.reload')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={table.tableState.readState !== 'pending'}
            onClick={table.cancel}
          >
            {t('examples.tables.cancel')}
          </Button>
        </div>
      </div>
      <DataTable
        profile="list"
        {...table.tableState}
        getRowId={getRowId}
        columns={columns.list}
        caption={t('examples.tables.server')}
        labels={columns.labels}
      />
    </ExampleGroup>
  );
}
