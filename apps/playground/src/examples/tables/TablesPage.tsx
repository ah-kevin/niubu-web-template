import { DocumentationLink } from '../DocumentationLink';
import { useEffect, useMemo, useRef, useState } from 'react';
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
    <section className="grid min-w-0 gap-6">
      <h1>{t('examples.tables.title')}</h1>
      <DocumentationLink kind="tables" />
      <p>{t('examples.tables.synthetic')}</p>
      <p>{t('examples.tables.boundary')}</p>
      <label>
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
        <ClientExamples key={scope} scope={scope} t={t} />
        <ServerExample scope={scope} load={load} t={t} />
      </PreferenceProvider>
    </section>
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
      <DataTable
        profile="read"
        model={clientModel}
        {...clientRead}
        getRowId={getRowId}
        columns={columns.read}
        caption={t('examples.tables.read')}
        labels={columns.labels}
      />
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
    <div className="grid gap-3">
      <table.queryForm.Form submitLabel={t('examples.tables.query')} resetLabel={t('examples.tables.reset')} />
      <div className="flex gap-2">
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
      <DataTable
        profile="list"
        {...table.tableState}
        getRowId={getRowId}
        columns={columns.list}
        caption={t('examples.tables.server')}
        labels={columns.labels}
      />
    </div>
  );
}
