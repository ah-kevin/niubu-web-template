import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  createDataTableLabels,
  createListColumnHelper,
  DataTable,
  useQueryDataTable,
  type ListColumnDef,
  type QueryRequest,
} from '@niubu/common-ui/data-table';
import { Modal, Drawer, useOverlay } from '@niubu/common-ui/overlay';
import { Button } from '@niubu/shadcn-ui/button';
import { Badge } from '@niubu/shadcn-ui/badge';
import { useTranslation } from '@niubu/locales/react';
import type { AuthContext } from '@niubu/types';
import { usePlaygroundApi } from '../app/api-context';
import { useAuthSnapshot, usePlaygroundAuth } from '../auth/context';
import { playgroundScopeQueryKey } from '../auth/query-context';
import { unwrapSystemResult } from './api';
import type { QueryByResource, RecordByResource, ResourceKind, SystemRecord } from './contracts';
import { createQueryOptions, type QueryCriteria, type QueryValues } from './form-schemas';
import {
  ownerScopeKey,
  recordName,
  referenceLabel,
  resourceConfig,
  type Lookups,
  type Translate,
} from './resource-config';
import {
  cancelled,
  currentLease,
  invalidateResource,
  ReconfirmSystemWrite,
  requireLease,
  systemErrorCopy,
  useResourceLookups,
  writeWithRecovery,
} from './resource-runtime';
import { ResourceEditor } from './ResourceEditor';

type Panel<K extends ResourceKind> = {
  mode: 'create' | 'edit' | 'detail';
  session: number;
  record?: RecordByResource[K];
  owner: AuthContext;
  ownerKey: string;
};
function detailValue(name: string, record: SystemRecord, lookups: Lookups, t: Translate): string {
  const value = name in record ? record[name as keyof typeof record] : undefined;
  if (name === 'roleId' && 'roleId' in record) return referenceLabel(lookups.roles, record.roleId, t);
  if (name === 'departmentId' && 'departmentId' in record)
    return referenceLabel(lookups.departments, record.departmentId, t);
  if (name === 'parentId' && 'parentId' in record)
    return referenceLabel('kind' in record ? lookups.menus : lookups.departments, record.parentId, t);
  if (name === 'kind' && 'kind' in record) return t(`system.kind.${record.kind}`);
  if (typeof value === 'boolean') return t(value ? 'system.yes' : 'system.no');
  return value === undefined ? t('system.notApplicable') : String(value);
}
function RecordDetail({
  record,
  resource,
  lookups,
  t,
}: {
  record: SystemRecord;
  resource: ResourceKind;
  lookups: Lookups;
  t: Translate;
}) {
  return (
    <dl className="system-record-detail">
      {['id', ...resourceConfig[resource].fields]
        .filter(name => name in record)
        .map(name => (
          <div key={name}>
            <dt>{t(`system.field.${name}`)}</dt>
            <dd>{detailValue(name, record, lookups, t)}</dd>
          </div>
        ))}
    </dl>
  );
}

export function ResourcePage<K extends ResourceKind>({ resource }: { resource: K }) {
  const state = useAuthSnapshot();
  return (
    <ResourcePageBody
      key={JSON.stringify([state.user?.id ?? null, state.scope?.kind ?? null, state.scope?.id ?? null, resource])}
      resource={resource}
    />
  );
}
function ResourcePageBody<K extends ResourceKind>({ resource }: { resource: K }) {
  const { t } = useTranslation('app');
  const api = usePlaygroundApi(),
    auth = usePlaygroundAuth(),
    state = useAuthSnapshot();
  const queryClient = useQueryClient(),
    overlay = useOverlay();
  const config = resourceConfig[resource],
    context = api.getContext();
  const readable = Boolean(context && state.codes.includes(`system:${resource}:read`));
  const writable = readable && state.codes.includes(`system:${resource}:write`);
  const ownerKey = ownerScopeKey(state.user?.id ?? '', state.scope);
  const actionKey = JSON.stringify([ownerKey, state.generation, resource]);
  const sessionSignal = auth.requestContext().signal;
  const lookup = useResourceLookups(api, resource, context, sessionSignal, readable);
  const queryOptions = useMemo(() => createQueryOptions(resource, t, lookup.lookups), [resource, t, lookup.lookups]);
  async function load({ query, pagination, sorting, signal: wrapperSignal }: QueryRequest<QueryCriteria>) {
    const captured = api.getContext();
    if (!captured || ownerScopeKey(captured.identityKey, captured.scope) !== ownerKey) throw cancelled();
    const signal = AbortSignal.any([wrapperSignal, auth.requestContext().signal]);
    const sort = sorting[0];
    const queryInput = {
      ...query,
      ...pagination,
      ...(sort ? { sortBy: sort.id, sortOrder: sort.desc ? ('desc' as const) : ('asc' as const) } : {}),
    } as QueryByResource[K];
    const queryKey = playgroundScopeQueryKey(captured, 'system', resource, query, pagination, sorting);
    // A repeated query must not deduplicate onto a previous wrapper's aborted read.
    await queryClient.cancelQueries({ queryKey, exact: true });
    requireLease(api, captured, signal);
    const result = await queryClient.fetchQuery({
      queryKey,
      retry: false,
      queryFn: async ({ signal: querySignal }) => {
        const merged = AbortSignal.any([signal, querySignal]);
        const page = unwrapSystemResult(await api.system[resource].list(captured, queryInput, merged));
        requireLease(api, captured, merged);
        return page;
      },
    });
    requireLease(api, captured, signal);
    return result;
  }
  const table = useQueryDataTable<QueryValues, QueryCriteria, RecordByResource[K]>({
    queryForm: queryOptions,
    load,
    scopeKey: JSON.stringify([ownerKey, state.generation, resource]),
    enabled: readable,
    initialPageSize: 10,
  });
  const { updateFields, getValues } = table.queryForm;
  useEffect(() => {
    updateFields(createQueryOptions(resource, t, lookup.lookups, getValues()).fields);
  }, [updateFields, getValues, resource, t, lookup.lookups]);
  const [panel, setPanel] = useState<Panel<K> | null>(null);
  const panelRef = useRef(panel),
    sequence = useRef(0),
    action = useRef<AbortController | null>(null);
  const cancelEditor = useRef<(() => void) | null>(null);
  const [actionState, setActionState] = useState<{ requestKey: string; pending?: boolean; error?: string } | null>(
    null,
  );
  useLayoutEffect(() => {
    panelRef.current = panel;
  }, [panel]);
  useLayoutEffect(() => {
    return () => {
      action.current?.abort();
      action.current = null;
    };
  }, [ownerKey, state.generation, resource]);
  const registerCancel = useCallback((cancel: (() => void) | null) => {
    cancelEditor.current = cancel;
  }, []);
  function beginAction() {
    action.current?.abort();
    const local = new AbortController();
    action.current = local;
    const captured = api.getContext();
    if (!captured || ownerScopeKey(captured.identityKey, captured.scope) !== ownerKey) throw cancelled();
    const signal = AbortSignal.any([local.signal, auth.requestContext().signal]);
    setActionState({ requestKey: actionKey, pending: true });
    return {
      context: captured,
      signal,
      current: () => action.current === local && currentLease(api, captured, signal),
    };
  }
  function create() {
    const captured = api.getContext();
    if (!captured || !writable || !lookup.ready) return;
    action.current?.abort();
    setActionState(null);
    setPanel({ mode: 'create', session: ++sequence.current, owner: captured, ownerKey });
  }
  async function openRecord(mode: 'edit' | 'detail', id: string) {
    let lease: ReturnType<typeof beginAction> | undefined;
    try {
      lease = beginAction();
      const record = unwrapSystemResult(await api.system[resource].get(lease.context, id, lease.signal));
      if (!lease.current()) return;
      setActionState(null);
      setPanel({ mode, session: ++sequence.current, record, owner: lease.context, ownerKey });
    } catch (error) {
      if (lease?.current()) setActionState({ requestKey: actionKey, error: systemErrorCopy(error, t) });
    }
  }
  async function remove(record: RecordByResource[K]) {
    if (!writable) return;
    let lease: ReturnType<typeof beginAction> | undefined;
    try {
      lease = beginAction();
      const approved = await overlay.confirm({
        title: t('system.deleteTitle', { name: recordName(record) }),
        description: t('system.deleteDescription'),
        signal: lease.signal,
      });
      if (!lease.current()) return;
      if (!approved) {
        setActionState(null);
        return;
      }
      const captured = lease;
      await writeWithRecovery(api, api.system[resource], captured.context, captured.signal, () =>
        api.system[resource].remove(captured.context, record.id, captured.signal),
      );
      if (!lease.current()) return;
      await invalidateResource(queryClient, lease.context, resource);
      if (!lease.current()) return;
      lookup.retry();
      await table.reload();
      if (lease.current()) setActionState(null);
    } catch (error) {
      if (!lease?.current()) return;
      if (error instanceof ReconfirmSystemWrite)
        setActionState({ requestKey: actionKey, error: t('system.reconfirmDelete') });
      else setActionState({ requestKey: actionKey, error: systemErrorCopy(error, t) });
    }
  }
  const headers = Object.fromEntries([...config.fields, 'actions'].map(name => [name, t(`system.field.${name}`)]));
  const helper = createListColumnHelper<RecordByResource[K]>();
  // One server model from useQueryDataTable owns all paging, metadata and sorting.
  const columns: ListColumnDef<RecordByResource[K], unknown>[] = config.fields
    .filter(name => !['description', 'href', 'pageId', 'openInNewWindow'].includes(name))
    .map(name =>
      helper.accessor((row): unknown => detailValue(name, row, lookup.lookups, t), {
        id: name,
        header: headers[name],
        enableSorting: (config.sortable as readonly string[]).includes(name),
        cell: info =>
          name === 'enabled' ? (
            <Badge>{t(info.row.original.enabled ? 'system.enabled' : 'system.disabled')}</Badge>
          ) : (
            info.getValue()
          ),
      }),
    );
  columns.push(
    helper.display({
      id: 'actions',
      header: headers.actions,
      enableSorting: false,
      cell: info => {
        const record = info.row.original,
          name = recordName(record);
        return (
          <div className="system-row-actions">
            <Button
              type="button"
              variant="ghost"
              aria-label={t('system.viewAction', { name })}
              onClick={() => void openRecord('detail', record.id)}
            >
              {t('system.view')}
            </Button>
            {writable && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t('system.editAction', { name })}
                  disabled={!lookup.ready}
                  onClick={() => void openRecord('edit', record.id)}
                >
                  {t('system.edit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t('system.deleteAction', { name })}
                  onClick={() => void remove(record)}
                >
                  {t('system.delete')}
                </Button>
              </>
            )}
          </div>
        );
      },
    }),
  );
  function closePanel(session: number) {
    if (panelRef.current?.session === session) setPanel(null);
  }
  function submitted(opened: Panel<K>) {
    const current = api.getContext();
    if (
      !current ||
      panelRef.current?.session !== opened.session ||
      ownerScopeKey(current.identityKey, current.scope) !== opened.ownerKey
    )
      return;
    setPanel(null);
    lookup.retry();
    void table.reload();
  }
  const shown = panel?.ownerKey === ownerKey ? panel : null;
  const Overlay = shown?.mode === 'create' ? Modal : Drawer;
  return (
    <section className="playground-page system-resource-page">
      <header className="system-page-header">
        <div>
          <h1>{t(config.titleKey)}</h1>
          <p className="system-demo-notice">{t('system.demoNotice')}</p>
        </div>
        {writable && (
          <Button type="button" disabled={!lookup.ready} onClick={create}>
            {t('system.create')}
          </Button>
        )}
      </header>
      <table.queryForm.Form submitLabel={t('common:search')} resetLabel={t('common:reset')} />
      {lookup.error && (
        <div role="alert">
          {t('system.lookupFailed')}{' '}
          <Button type="button" variant="outline" onClick={lookup.retry}>
            {t('retry')}
          </Button>
        </div>
      )}
      {actionState?.requestKey === actionKey && actionState.pending && <p role="status">{t('pending')}</p>}
      {actionState?.requestKey === actionKey && actionState.error && <p role="alert">{actionState.error}</p>}
      <DataTable<RecordByResource[K]>
        profile="list"
        columns={columns}
        getRowId={row => row.id}
        caption={t(config.titleKey)}
        labels={createDataTableLabels(t, headers)}
        {...table.tableState}
      />
      {table.tableState.readState === 'error' && (
        <Button type="button" variant="outline" onClick={() => void table.reload()}>
          {t('retry')}
        </Button>
      )}
      {shown && (
        <Overlay
          key={JSON.stringify([shown.ownerKey, resource, shown.record?.id ?? null, shown.session])}
          open
          title={t(
            shown.mode === 'detail'
              ? 'system.detailTitle'
              : shown.mode === 'edit'
                ? 'system.editTitle'
                : 'system.createTitle',
            { resource: t(config.titleKey) },
          )}
          description={t('system.demoNotice')}
          footer={null}
          onOpenChange={open => {
            if (!open) {
              if (shown.mode !== 'detail' && cancelEditor.current) cancelEditor.current();
              else closePanel(shown.session);
            }
          }}
          onRequestClose={() => {
            if (shown.mode !== 'detail' && cancelEditor.current) cancelEditor.current();
            else closePanel(shown.session);
          }}
        >
          {shown.mode === 'detail' && shown.record ? (
            <RecordDetail record={shown.record} resource={resource} lookups={lookup.lookups} t={t} />
          ) : (
            <ResourceEditor
              resource={resource}
              record={shown.record}
              owner={shown.owner}
              lookups={lookup.lookups}
              lookupReady={lookup.ready}
              onCancel={() => closePanel(shown.session)}
              onCancelReady={registerCancel}
              onSubmitted={() => submitted(shown)}
            />
          )}
        </Overlay>
      )}
    </section>
  );
}
