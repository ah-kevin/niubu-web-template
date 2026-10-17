import { describe, expect, it } from 'vitest';
import { StrictMode } from 'react';
import { createPortal } from 'react-dom';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { useQueryDataTable } from './useQueryDataTable';
import { QueryDataTable } from './QueryDataTable';
import { createListColumnHelper } from './columns';
import { createAppStores } from '@niubu/stores';
import { StoresProvider } from '@niubu/stores/react';
import type { SchemaFormOptions } from '../form/schema-types';
import type { QueryDataTableApi } from './query-types';
import type { TableLabels } from './types';
import { createQueryController } from './query-controller';
import type { QueryPage, QueryRequest } from './query-types';

type Filter = { term: string; enabled: boolean };
type RecordRow = { id: string };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const requests: QueryRequest<Filter>[] = [];
  const replies: ReturnType<typeof deferred<QueryPage<RecordRow>>>[] = [];
  const controller = createQueryController<Filter, RecordRow>({
    load: request => { requests.push(request); const reply = deferred<QueryPage<RecordRow>>(); replies.push(reply); return reply.promise; },
    initialPageSize: 10,
  });
  controller.configure('north', true);
  return { controller, requests, replies };
}
const defaults = { term: '', enabled: false };
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('query request controller', () => {
  it('keeps a completed result when cancellation has no active read', async () => {
    const { controller, replies } = fixture();
    const done = controller.apply(defaults);
    replies[0]!.resolve({ rows: [{ id: 'kept' }], rowCount: 1 });
    await done;
    const settled = controller.getSnapshot();
    controller.cancel();
    expect(controller.getSnapshot()).toBe(settled);
  });
  it('publishes cancellation without invented results and ignores the retired reply', async () => {
    const { controller, requests, replies } = fixture();
    void controller.apply(defaults);
    controller.cancel();
    expect(requests[0]!.signal.aborted).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ readState: 'cancelled', sourceCount: null, resultCount: null, model: { rows: [] } });
    replies[0]!.resolve({ rows: [{ id: 'late' }], rowCount: 1 });
    await settle();
    expect(controller.getSnapshot()).toMatchObject({ readState: 'cancelled', model: { rows: [] } });
  });
  it('cancels before a validated query has dispatched its first HTTP request', () => {
    const { controller, requests } = fixture();
    const ticket = controller.beginQuery();
    controller.cancel();
    expect(controller.isCurrent(ticket)).toBe(false);
    expect(controller.getSnapshot().readState).toBe('cancelled');
    expect(requests).toHaveLength(0);
  });
  it('does not let a completed older validation release the current validation ticket', async () => {
    const { controller, replies } = fixture();
    const done = controller.apply(defaults);
    replies[0]!.resolve({ rows: [{ id: 'kept' }], rowCount: 1 });
    await done;
    const older = controller.beginQuery();
    controller.beginQuery();
    controller.endValidation(older);
    controller.cancel();
    expect(controller.getSnapshot().readState).toBe('cancelled');
  });
  it('applies new filters from page zero without mutating the applied copy or performing an extra page fetch', async () => {
    const { controller, requests, replies } = fixture();
    void controller.apply(defaults); replies[0]!.resolve({ rows: [], rowCount: 40 }); await settle();
    controller.getSnapshot().pagination.onChange({ pageIndex: 2, pageSize: 10 });
    const output = { term: 'search', enabled: true };
    void controller.apply(output); output.term = 'edited after applying';
    expect(requests).toHaveLength(3);
    expect(requests[2]).toMatchObject({ query: { term: 'search', enabled: true }, pagination: { pageIndex: 0, pageSize: 10 } });
    requests[2]!.query.term = 'loader mutation';
    void controller.reload();
    expect(requests[3]!.query).toEqual({ term: 'search', enabled: true });
  });
  it('does not recursively refetch forever if the clamped reply shrinks again', async () => {
    const { controller, requests, replies } = fixture();
    void controller.apply(defaults); replies[0]!.resolve({ rows: [], rowCount: 40 }); await settle();
    controller.getSnapshot().pagination.onChange({ pageIndex: 3, pageSize: 10 });
    replies[1]!.resolve({ rows: [], rowCount: 21 }); await settle();
    expect(requests[2]!.pagination.pageIndex).toBe(2);
    replies[2]!.resolve({ rows: [], rowCount: 0 }); await settle();
    expect(requests).toHaveLength(3);
    expect(controller.getSnapshot()).toMatchObject({ readState: 'ready', sourceCount: null, resultCount: 0, pagination: { value: { pageIndex: 0 } } });
  });


  it('marks a second nonzero page shrink as retryable error instead of inventing ready rows', async () => {
    const { controller, requests, replies } = fixture();
    void controller.apply(defaults); replies[0]!.resolve({ rows: [], rowCount: 40 }); await settle();
    controller.getSnapshot().pagination.onChange({ pageIndex: 3, pageSize: 10 });
    replies[1]!.resolve({ rows: [], rowCount: 21 }); await settle();
    replies[2]!.resolve({ rows: [], rowCount: 11 }); await settle();
    expect(requests).toHaveLength(3);
    expect(controller.getSnapshot()).toMatchObject({ readState: 'error', sourceCount: null, resultCount: null, pagination: { value: { pageIndex: 1 } } });
  });
  it('captures false/default filters and reports filtered totals with unknown source', async () => {
    const { controller, requests, replies } = fixture();
    const filter = { ...defaults };
    const done = controller.apply(filter);
    filter.term = 'draft';
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ query: { term: '', enabled: false }, pagination: { pageIndex: 0, pageSize: 10 }, sorting: [] });
    expect(controller.getSnapshot()).toMatchObject({ readState: 'pending', sourceCount: null, resultCount: null });
    replies[0]!.resolve({ rows: [{ id: 'one' }], rowCount: 31 }); await done;
    expect(controller.getSnapshot()).toMatchObject({ readState: 'ready', sourceCount: null, resultCount: 31, model: { kind: 'server', rows: [{ id: 'one' }], rowCount: 31 } });
  });
  it('uses applied filters for functional page, page-size, sort and reload updates exactly once', async () => {
    const { controller, requests, replies } = fixture();
    void controller.apply(defaults);
    replies[0]!.resolve({ rows: [], rowCount: 50 }); await settle();
    controller.getSnapshot().pagination.onChange(previous => ({ ...previous, pageIndex: 2 }));
    expect(requests).toHaveLength(2);
    expect(requests[1]!.pagination).toEqual({ pageIndex: 2, pageSize: 10 });
    controller.getSnapshot().pagination.onChange(previous => ({ ...previous, pageSize: 20 }));
    expect(requests).toHaveLength(3);
    expect(requests[2]!.pagination).toEqual({ pageIndex: 0, pageSize: 20 });
    controller.getSnapshot().sorting.onChange(previous => [...previous, { id: 'id', desc: true }]);
    expect(requests).toHaveLength(4);
    expect(requests[3]).toMatchObject({ query: defaults, pagination: { pageIndex: 0, pageSize: 20 }, sorting: [{ id: 'id', desc: true }] });
    void controller.reload();
    expect(requests).toHaveLength(5);
    expect(requests[4]!.sorting).toEqual([{ id: 'id', desc: true }]);
    expect(requests.slice(0, 4).every(request => request.signal.aborted)).toBe(true);
  });
  it.each([11, 0])('clamps a shrunken final page once for rowCount=%i', async rowCount => {
    const { controller, requests, replies } = fixture();
    void controller.apply(defaults); replies[0]!.resolve({ rows: [], rowCount: 31 }); await settle();
    controller.getSnapshot().pagination.onChange({ pageIndex: 3, pageSize: 10 });
    replies[1]!.resolve({ rows: [], rowCount }); await settle();
    expect(requests).toHaveLength(3);
    expect(requests[2]!.pagination.pageIndex).toBe(rowCount === 0 ? 0 : 1);
    replies[2]!.resolve({ rows: [], rowCount }); await settle();
    expect(requests).toHaveLength(3);
    expect(controller.getSnapshot()).toMatchObject({ readState: 'ready', resultCount: rowCount });
  });
  it('does not let an aborted old page or error overwrite a newer result', async () => {
    const { controller, requests, replies } = fixture();
    void controller.apply(defaults);
    controller.getSnapshot().pagination.onChange({ pageIndex: 1, pageSize: 10 });
    expect(requests[0]!.signal.aborted).toBe(true);
    replies[1]!.resolve({ rows: [{ id: 'current' }], rowCount: 20 }); await settle();
    replies[0]!.reject(new Error('late failure')); await settle();
    expect(controller.getSnapshot()).toMatchObject({ readState: 'ready', model: { rows: [{ id: 'current' }] } });
  });
  it('clears counts and visible rows on failures instead of reporting empty success', async () => {
    const { controller, replies } = fixture();
    const first = controller.apply(defaults); replies[0]!.resolve({ rows: [{ id: 'old' }], rowCount: 30 }); await first;
    const done = controller.reload(); replies[1]!.reject(new Error('unavailable')); await done;
    expect(controller.getSnapshot()).toMatchObject({ readState: 'error', sourceCount: null, resultCount: null, model: { rows: [] } });
    expect(controller.getSnapshot().error).toBeInstanceOf(Error);
  });
  it('retires validation tokens, scope requests and same-scope reentry generations', async () => {
    const { controller, requests, replies } = fixture();
    const ticket = controller.beginQuery();
    controller.configure('south', true);
    await controller.apply(defaults, ticket);
    expect(requests).toHaveLength(0);
    void controller.apply(defaults);
    controller.configure('north', true);
    expect(requests[0]!.signal.aborted).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ readState: 'pending', model: { rows: [] }, resultCount: null });
    void controller.apply({ term: 'new generation', enabled: true });
    replies[1]!.resolve({ rows: [{ id: 'new' }], rowCount: 1 }); await settle();
    replies[0]!.resolve({ rows: [{ id: 'old' }], rowCount: 1 }); await settle();
    expect(controller.getSnapshot().model.rows).toEqual([{ id: 'new' }]);
  });
  it('disables and cancels requests but can activate again after effect cleanup', async () => {
    const { controller, requests, replies } = fixture();
    void controller.apply(defaults);
    replies[0]!.resolve({ rows: [{ id: 'old' }], rowCount: 1 }); await settle();
    controller.configure('north', false);
    expect(controller.getSnapshot().model.rows).toEqual([]);
    await controller.reload(); expect(requests).toHaveLength(1);
    controller.configure('north', true); void controller.apply(defaults);
    controller.deactivate(); expect(requests[1]!.signal.aborted).toBe(true);
    controller.configure('north', true); void controller.apply(defaults);
    replies[2]!.resolve({ rows: [{ id: 'active' }], rowCount: 1 }); await settle();
    replies[1]!.resolve({ rows: [{ id: 'stale' }], rowCount: 1 }); await settle();
    expect(controller.getSnapshot().model.rows).toEqual([{ id: 'active' }]);
    controller.cancel(); void controller.reload(); expect(requests).toHaveLength(4);
  });
});

const filterOptions: SchemaFormOptions<Filter, Filter> = {
  fields: [{ name: 'term', label: 'Filter', kind: 'text' }, { name: 'enabled', label: 'Enabled', kind: 'checkbox' }],
  defaultValues: defaults,
  transform: values => ({ term: values.term ?? '', enabled: values.enabled ?? false }),
};
const labels: TableLabels = {
  pending: 'Pending', error: 'Load failed', sourceEmpty: 'Source empty', sourceUnknown: 'Unknown source', filteredEmpty: 'No matches', pageEmpty: 'Empty page',
  previousPage: 'Previous', nextPage: 'Next', pageSize: 'Page size', settings: 'Settings', resetColumns: 'Reset columns', pinStart: 'Pin start', pinEnd: 'Pin end', unpin: 'Unpin',
  columnName: id => id, showColumn: id => `Show ${id}`, columnWidth: id => `Width ${id}`, resizeColumn: id => `Resize ${id}`, pinColumn: id => `Pin ${id}`, sortColumn: id => `Sort ${id}`,
  page: (page, total) => `${page}/${total}`, total: count => `Total ${count}`,
};
const columnsHelper = createListColumnHelper<RecordRow>();
const queryColumns = columnsHelper.columns([columnsHelper.accessor('id', { id: 'id', header: 'ID' })]);

describe('query table with the actual SchemaForm', () => {
  it.each(['submit', 'reset'])('leaves an independent portal form %s with its own owner', async operation => {
    const requests: QueryRequest<Filter>[] = [];
    let api!: QueryDataTableApi<Filter, Filter, RecordRow>;
    let portalSubmits = 0;
    let portalResets = 0;
    function Consumer() {
      api = useQueryDataTable<Filter, Filter, RecordRow>({
        queryForm: filterOptions, scopeKey: 'north', enabled: true,
        load: async request => { requests.push(request); return { rows: [{ id: 'kept' }], rowCount: 1 }; },
      });
      return <api.queryForm.Form submitLabel="Apply" resetLabel="Reset">
        <api.queryForm.Fields />
        {createPortal(<form aria-label="Independent portal form"
          onSubmit={event => { event.preventDefault(); event.stopPropagation(); ++portalSubmits; }}
          onReset={event => { event.preventDefault(); event.stopPropagation(); ++portalResets; }}>
          <input aria-label="Portal input" defaultValue="portal value" />
        </form>, document.body)}
      </api.queryForm.Form>;
    }
    render(<Consumer />);
    await waitFor(() => expect(api.tableState.readState).toBe('ready'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter' }), { target: { value: 'parent draft' } });
    const portalForm = screen.getByRole('form', { name: 'Independent portal form' });
    if (operation === 'submit') fireEvent.submit(portalForm); else fireEvent.reset(portalForm);
    await act(settle);
    expect(portalSubmits).toBe(operation === 'submit' ? 1 : 0);
    expect(portalResets).toBe(operation === 'reset' ? 1 : 0);
    expect(requests).toHaveLength(1);
    expect(api.queryForm.getValues().term).toBe('parent draft');
    expect(api.tableState.readState).toBe('ready');
    expect(api.tableState.model.rows).toEqual([{ id: 'kept' }]);
  });
  it.each(['query', 'submit', 'native'])('keeps settled rows when cancelling after an invalid %s has finished', async entry => {
    const requests: QueryRequest<Filter>[] = [];
    let api!: QueryDataTableApi<Filter, Filter, RecordRow>;
    function Consumer() {
      api = useQueryDataTable<Filter, Filter, RecordRow>({
        queryForm: {
          ...filterOptions,
          fields: [{ name: 'term', kind: 'text', label: 'Filter', schema: z.string().min(1, 'Required') }],
          defaultValues: { term: 'valid', enabled: false },
        },
        scopeKey: 'north', enabled: true,
        load: async request => { requests.push(request); return { rows: [{ id: 'kept' }], rowCount: 1 }; },
      });
      return <api.queryForm.Form submitLabel="Apply" />;
    }
    render(<Consumer />);
    await waitFor(() => expect(api.tableState.readState).toBe('ready'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter' }), { target: { value: '' } });
    if (entry === 'native') {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      await waitFor(() => expect(api.queryForm.form.getFieldState('term').error?.message).toBe('Required'));
      await act(settle);
    } else {
      await act(async () => { if (entry === 'query') await api.query(); else await api.queryForm.submit(); });
    }
    expect(api.queryForm.form.getFieldState('term').error?.message).toBe('Required');
    expect(requests).toHaveLength(1);
    expect(api.tableState.readState).toBe('ready');
    act(() => api.cancel());
    expect(api.tableState.readState).toBe('ready');
    expect(api.tableState.model.rows).toEqual([{ id: 'kept' }]);
  });

  it('ends automatic validation ownership before the applied initial data request completes', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const reply = deferred<QueryPage<RecordRow>>();
    const { result } = renderHook(() => useQueryDataTable<Filter, Filter, RecordRow>({
      queryForm: filterOptions, scopeKey: 'north', enabled: true,
      load: request => { requests.push(request); return reply.promise; },
    }));
    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => result.current.queryForm.updateFields([{ name: 'term', label: 'Localized filter' }]));
    await act(async () => {});
    expect(requests).toHaveLength(1);
    expect(requests[0]!.signal.aborted).toBe(false);
    await act(async () => reply.resolve({ rows: [{ id: 'initial' }], rowCount: 1 }));
    expect(result.current.tableState.model.rows).toEqual([{ id: 'initial' }]);
  });


  it('never revives a manually cancelled query after invalid initial defaults', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const { result } = renderHook(() => useQueryDataTable<Filter, Filter, RecordRow>({
      queryForm: { ...filterOptions, fields: [{ name: 'term', kind: 'text', label: 'Filter', schema: z.string().min(1) }], defaultValues: defaults },
      scopeKey: 'north', enabled: true,
      load: async request => { requests.push(request); return { rows: [], rowCount: 0 }; },
    }));
    await waitFor(() => expect(result.current.queryForm.form.getFieldState('term').error).toBeDefined());
    expect(requests).toHaveLength(0);
    let pending!: Promise<void>;
    act(() => {
      result.current.queryForm.setValues({ term: 'unsent draft' });
      pending = result.current.query();
      result.current.queryForm.updateFields([{ name: 'term', label: 'Localized filter' }]);
    });
    await act(async () => pending);
    expect(requests).toHaveLength(0);
    expect(result.current.queryForm.getValues().term).toBe('unsent draft');
    await act(async () => result.current.query());
    expect(requests).toHaveLength(1);
  });


  it('restarts only the initial automatic validation after its configuration is patched', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const { result } = renderHook(() => useQueryDataTable<Filter, Filter, RecordRow>({
      queryForm: { ...filterOptions, defaultValues: { term: 'initial', enabled: false } },
      scopeKey: 'north', enabled: true,
      load: async request => { requests.push(request); return { rows: [], rowCount: 0 }; },
    }));
    act(() => result.current.queryForm.updateFields([{ name: 'term', label: 'Updated filter' }]));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.query.term).toBe('initial');
    act(() => {
      result.current.queryForm.setValues({ term: 'unsent draft' });
      result.current.queryForm.updateFields([{ name: 'term', label: 'Localized filter' }]);
    });
    await act(async () => {});
    expect(requests).toHaveLength(1);
    expect(result.current.queryForm.getValues().term).toBe('unsent draft');
  });


  it('retires programmatic validation synchronously when field configuration changes', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const { result } = renderHook(() => useQueryDataTable<Filter, Filter, RecordRow>({
      queryForm: { ...filterOptions, defaultValues: { term: 'short', enabled: false } },
      scopeKey: 'north', enabled: true,
      load: async request => { requests.push(request); return { rows: [], rowCount: 0 }; },
    }));
    await waitFor(() => expect(requests).toHaveLength(1));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.query();
      result.current.queryForm.updateFields([{ name: 'term', schema: z.string().min(10) }]);
    });
    await act(async () => pending);
    expect(requests).toHaveLength(1);
    expect(result.current.queryForm.getValues().term).toBe('short');
    act(() => result.current.queryForm.setValues({ term: 'valid replacement' }));
    await act(async () => result.current.query());
    expect(requests).toHaveLength(2);
    expect(requests[1]!.query.term).toBe('valid replacement');
  });

  it('preserves raw draft and applied criteria/page across data generation and enabled changes', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const { result, rerender } = renderHook(({ scopeKey, enabled }) => useQueryDataTable<Filter, Filter, RecordRow>({
      queryForm: filterOptions, scopeKey, enabled,
      load: async request => { requests.push(request); return { rows: [{ id: scopeKey }], rowCount: 30 }; },
    }), { initialProps: { scopeKey: 'north:g1', enabled: true } });
    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => result.current.queryForm.setValues({ term: 'applied', enabled: true }));
    await act(async () => result.current.query());
    act(() => result.current.tableState.pagination.onChange({ pageIndex: 1, pageSize: 10 }));
    await waitFor(() => expect(requests).toHaveLength(3));
    act(() => result.current.queryForm.setValues({ term: 'unsent draft' }, { shouldDirty: true }));
    const form = result.current.queryForm.form;
    const Form = result.current.queryForm.Form;
    rerender({ scopeKey: 'north:g2', enabled: false });
    expect(result.current.tableState.model.rows).toEqual([]);
    expect(result.current.queryForm.getValues().term).toBe('unsent draft');
    expect(requests).toHaveLength(3);
    rerender({ scopeKey: 'north:g3', enabled: true });
    await waitFor(() => expect(requests).toHaveLength(4));
    expect(requests[3]).toMatchObject({ query: { term: 'applied', enabled: true }, pagination: { pageIndex: 1, pageSize: 10 } });
    expect(result.current.queryForm.form).toBe(form); expect(result.current.queryForm.Form).toBe(Form);
    expect(result.current.queryForm.getValues().term).toBe('unsent draft');
    expect(result.current.queryForm.form.formState.isDirty).toBe(true);
  });

  it('does not publish late scope/disabled replies or let a cancelled validation issue a request', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const replies: ReturnType<typeof deferred<QueryPage<RecordRow>>>[] = [];
    const { result, rerender, unmount } = renderHook(({ scopeKey, enabled }) => useQueryDataTable<Filter, Filter, RecordRow>({
      queryForm: filterOptions, scopeKey, enabled,
      load: request => { requests.push(request); const reply = deferred<QueryPage<RecordRow>>(); replies.push(reply); return reply.promise; },
    }), { initialProps: { scopeKey: 'north', enabled: true } });
    await waitFor(() => expect(requests).toHaveLength(1));
    rerender({ scopeKey: 'south', enabled: true });
    expect(result.current.tableState.model.rows).toEqual([]);
    expect(requests[0]!.signal.aborted).toBe(true);
    await waitFor(() => expect(requests).toHaveLength(2));
    await act(async () => replies[1]!.resolve({ rows: [{ id: 'south' }], rowCount: 1 }));
    await act(async () => replies[0]!.resolve({ rows: [{ id: 'north stale' }], rowCount: 1 }));
    expect(result.current.tableState.model.rows).toEqual([{ id: 'south' }]);
    let pending!: Promise<void>;
    act(() => { pending = result.current.query(); result.current.cancel(); });
    await act(async () => pending);
    expect(requests).toHaveLength(2);
    expect(result.current.tableState).toMatchObject({ readState: 'cancelled', model: { rows: [] }, sourceCount: null, resultCount: null });
    rerender({ scopeKey: 'south', enabled: false });
    expect(result.current.tableState).toMatchObject({ readState: 'pending', model: { rows: [] }, sourceCount: null, resultCount: null });
    rerender({ scopeKey: 'north', enabled: true });
    await waitFor(() => expect(requests).toHaveLength(3));
    unmount(); expect(requests[2]!.signal.aborted).toBe(true);
    await act(async () => replies[2]!.resolve({ rows: [{ id: 'unmounted' }], rowCount: 1 }));
  });
  it('cancels pre-application native submit on edit but keeps an already applied fetch independent', async () => {
    const requests: QueryRequest<Filter>[] = [];
    let api!: QueryDataTableApi<Filter, Filter, RecordRow>;
    function Consumer() {
      api = useQueryDataTable<Filter, Filter, RecordRow>({ queryForm: filterOptions, scopeKey: 'north', enabled: true,
        load: async request => { requests.push(request); return { rows: [], rowCount: 0 }; } });
      return <api.queryForm.Form submitLabel="Apply" />;
    }
    render(<Consumer />);
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter' }), { target: { value: 'candidate' } });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Filter' }), { target: { value: 'new draft' } });
    });
    await act(settle);
    expect(requests).toHaveLength(1);
    expect(api.queryForm.getValues().term).toBe('new draft');
  });

  it('loads once, preserves draft edits while applied fetch is pending, and submits/resets exactly once', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const replies: ReturnType<typeof deferred<QueryPage<RecordRow>>>[] = [];
    let api!: QueryDataTableApi<Filter, Filter, RecordRow>;
    let validations = 0;
    const schema = z.object({ term: z.string(), enabled: z.boolean() }).superRefine(() => { ++validations; });
    const stores = createAppStores({ identityKey: 'query-only', readContext: null });
    function Consumer() {
      api = useQueryDataTable<Filter, Filter, RecordRow>({ queryForm: { ...filterOptions, schema }, scopeKey: 'north', enabled: true,
        load: request => { requests.push(request); const reply = deferred<QueryPage<RecordRow>>(); replies.push(reply); return reply.promise; } });
      return <api.queryForm.Form submitLabel="Apply" resetLabel="Reset" />;
    }
    const view = render(<StoresProvider stores={stores}><Consumer /></StoresProvider>);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(validations).toBe(1);
    const originalForm = api.queryForm.Form, originalFields = api.queryForm.Fields;
    const input = screen.getByRole('textbox', { name: 'Filter' });
    fireEvent.change(input, { target: { value: 'draft' } });
    expect(requests[0]!.signal.aborted).toBe(false);
    await act(async () => replies[0]!.resolve({ rows: [{ id: 'applied' }], rowCount: 1 }));
    expect(api.tableState.model.rows).toEqual([{ id: 'applied' }]);
    expect(requests).toHaveLength(1);
    expect(stores.interaction.getSnapshot().dirty).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(validations).toBe(2);
    expect(api.queryForm.Form).toBe(originalForm); expect(api.queryForm.Fields).toBe(originalFields);
    expect(screen.getByRole('textbox', { name: 'Filter' })).toBe(input);
    expect(requests[1]!.query).toEqual({ term: 'draft', enabled: false });
    fireEvent.change(input, { target: { value: 'later draft' } });
    expect(requests[1]!.signal.aborted).toBe(false);
    await act(async () => replies[1]!.resolve({ rows: [{ id: 'draft result' }], rowCount: 20 }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(validations).toBe(3);
    expect(requests[2]!.query).toEqual(defaults);
    expect(input).toHaveValue('');
    expect(stores.interaction.getSnapshot().dirty).toBe(false);
    view.unmount(); expect(requests[2]!.signal.aborted).toBe(true);
    stores.dispose();
  });
  it('validates programmatic query once and never loads an invalid draft', async () => {
    let validations = 0;
    const schema = z.object({ term: z.string(), enabled: z.boolean() }).superRefine((values, ctx) => {
      ++validations;
      if (values.term === 'invalid') ctx.addIssue({ code: 'custom', path: ['term'], message: 'Invalid filter' });
    });
    const requests: QueryRequest<Filter>[] = [];
    const { result } = renderHook(() => useQueryDataTable<Filter, Filter, RecordRow>({
      queryForm: { ...filterOptions, schema }, scopeKey: 'north', enabled: true,
      load: async request => { requests.push(request); return { rows: [], rowCount: 0 }; },
    }));
    await waitFor(() => expect(requests).toHaveLength(1));
    validations = 0;
    act(() => result.current.queryForm.setValues({ term: 'valid' }));
    await act(async () => result.current.query());
    expect(validations).toBe(1); expect(requests).toHaveLength(2);
    validations = 0;
    act(() => result.current.queryForm.setValues({ term: 'invalid' }));
    await act(async () => result.current.query());
    expect(validations).toBe(1); expect(requests).toHaveLength(2);
    expect(result.current.queryForm.form.getFieldState('term').error?.message).toBe('Invalid filter');
  });
  it('uses defaults and real wrapper rendering without callback-driven reload loops', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const view = render(<QueryDataTable<Filter, Filter, RecordRow> queryForm={{ ...filterOptions }} scopeKey="north" enabled
      load={async request => { requests.push(request); return { rows: [{ id: 'server row' }], rowCount: 15 }; }}
      table={{ profile: 'list', caption: 'Query rows', getRowId: row => row.id, columns: queryColumns, labels }} />);
    expect(await screen.findByText('server row')).toBeVisible();
    expect(screen.getByText('Total 15')).toBeVisible();
    expect(requests).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]!.pagination.pageIndex).toBe(1);
    view.rerender(<QueryDataTable<Filter, Filter, RecordRow> queryForm={{ ...filterOptions }} scopeKey="north" enabled
      load={async request => { requests.push(request); return { rows: [{ id: 'server row' }], rowCount: 15 }; }}
      table={{ profile: 'list', caption: 'Query rows', getRowId: row => row.id, columns: queryColumns, labels }} />);
    await act(settle); expect(requests).toHaveLength(2);
  });
  it('replays StrictMode effects without disposing the query owner permanently', async () => {
    const requests: QueryRequest<Filter>[] = [];
    const { result, rerender } = renderHook(({ scopeKey, enabled }) => useQueryDataTable<Filter, Filter, RecordRow>({ queryForm: { ...filterOptions }, scopeKey, enabled,
      load: async request => { requests.push(request); return { rows: [{ id: scopeKey }], rowCount: 1 }; } }),
      { initialProps: { scopeKey: 'north', enabled: true }, wrapper: ({ children }) => <StrictMode>{children}</StrictMode> });
    await waitFor(() => expect(result.current.tableState.readState).toBe('ready'));
    expect(requests).toHaveLength(1);
    rerender({ scopeKey: 'south', enabled: false });
    expect(result.current.tableState.model.rows).toEqual([]);
    rerender({ scopeKey: 'north', enabled: true });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(result.current.tableState.model.rows).toEqual([{ id: 'north' }]);
  });
});
