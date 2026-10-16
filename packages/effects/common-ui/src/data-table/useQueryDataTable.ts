import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import type { FieldValues } from 'react-hook-form';
import { useSchemaForm } from '../form/useSchemaForm';
import type { SchemaFormProps } from '../form/schema-types';
import type { CustomFieldParams } from '../form/types';
import type { OnChangeFn, PaginationState, SortingState } from './types';
import { createQueryController } from './query-controller';
import type { QueryDataTableApi, QueryDataTableOptions } from './query-types';

export function useQueryDataTable<V extends FieldValues, Q, R, C extends CustomFieldParams = CustomFieldParams>(
  options: QueryDataTableOptions<V, Q, R, C>,
): QueryDataTableApi<V, Q, R, C> {
  const [controller] = useState(() =>
    createQueryController<Q, R>({
      load: options.load,
      initialPageSize: options.initialPageSize,
    }),
  );
  useLayoutEffect(() => {
    controller.setLoader(options.load);
  });
  // The validated submit bridge owns a data request, independent of SchemaForm's edit lease.
  const onSubmit = useCallback(
    async (output: Q) => {
      await controller.apply(output);
    },
    [controller],
  );
  const schema = useSchemaForm<V, Q, C>({ ...options.queryForm, onSubmit });
  const schemaRef = useRef(schema);
  useLayoutEffect(() => {
    schemaRef.current = schema;
  });
  const validation = useRef({ version: 0, automatic: null as object | null, retryAutomatic: false });
  const invalidateValidation = useCallback(() => {
    ++validation.current.version;
    validation.current.automatic = null;
    validation.current.retryAutomatic = false;
  }, []);
  const prepare = useCallback(() => {
    invalidateValidation();
    schemaRef.current.cancel();
    return controller.beginQuery();
  }, [controller, invalidateValidation]);
  const runQuery = useCallback(
    async (automatic: boolean) => {
      const ticket = prepare();
      const validationId = validation.current.version;
      if (!controller.isCurrent(ticket)) return;
      const owner = automatic ? {} : null;
      validation.current.automatic = owner;
      try {
        const outcome = await schemaRef.current.validate();
        if (validation.current.automatic === owner) validation.current.automatic = null;
        if (outcome.valid && validationId === validation.current.version && controller.isCurrent(ticket))
          await controller.apply(schemaRef.current.toOutput(outcome.values), ticket);
      } catch {
        if (validationId === validation.current.version && controller.isCurrent(ticket)) controller.cancel();
      } finally {
        if (validation.current.automatic === owner) validation.current.automatic = null;
      }
    },
    [controller, prepare],
  );
  const query = useCallback(() => runQuery(false), [runQuery]);
  const reset = useCallback(async () => {
    schemaRef.current.reset();
    await query();
  }, [query]);
  const reload = useCallback(async () => {
    invalidateValidation();
    schemaRef.current.cancel();
    await controller.reload();
  }, [controller, invalidateValidation]);
  const cancel = useCallback(() => {
    invalidateValidation();
    schemaRef.current.cancel();
    controller.cancel();
  }, [controller, invalidateValidation]);
  const updateFields = useCallback<typeof schema.updateFields>(patches => {
    schemaRef.current.updateFields(patches);
    // Retire pending validation in this same stack, before React commits the new version.
    if (patches.length) {
      if (validation.current.automatic !== null) validation.current.retryAutomatic = true;
      ++validation.current.version;
    }
  }, []);
  useEffect(
    () =>
      schema.form.subscribe({
        formState: { values: true },
        callback: invalidateValidation,
      }),
    [schema.form, invalidateValidation],
  );
  useLayoutEffect(() => {
    const lifetime = validation.current;
    controller.configure(options.scopeKey, options.enabled);
    if (controller.hasApplied()) void controller.reload();
    else void runQuery(true);
    return () => {
      ++lifetime.version;
      lifetime.automatic = null;
      lifetime.retryAutomatic = false;
      schemaRef.current.cancel();
      controller.deactivate();
    };
  }, [controller, options.scopeKey, options.enabled, runQuery]);
  useEffect(() => {
    // Only a patch that interrupted an actual automatic validation may restart it.
    if (validation.current.retryAutomatic) void runQuery(true);
  }, [schema.configVersion, runQuery]);

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const onPaginationChange = useCallback<OnChangeFn<PaginationState>>(
    updater => {
      invalidateValidation();
      schemaRef.current.cancel();
      controller.getSnapshot().pagination.onChange(updater);
    },
    [controller, invalidateValidation],
  );
  const onSortingChange = useCallback<OnChangeFn<SortingState>>(
    updater => {
      invalidateValidation();
      schemaRef.current.cancel();
      controller.getSnapshot().sorting.onChange(updater);
    },
    [controller, invalidateValidation],
  );
  const tableState = useMemo(
    () => ({
      ...snapshot,
      pagination: { ...snapshot.pagination, onChange: onPaginationChange },
      sorting: { ...snapshot.sorting, onChange: onSortingChange },
    }),
    [snapshot, onPaginationChange, onSortingChange],
  );

  const bindings = useRef({ schema, reset, prepare });
  useLayoutEffect(() => {
    bindings.current = { schema, reset, prepare };
  });
  const [Form] = useState(
    () =>
      function QueryForm(props: SchemaFormProps) {
        return createElement(
          'div',
          {
            onSubmitCapture: () => {
              bindings.current.prepare();
            },
            onResetCapture: (event: FormEvent<HTMLDivElement>) => {
              event.preventDefault();
              event.stopPropagation();
              void bindings.current.reset();
            },
          },
          createElement(bindings.current.schema.Form, props),
        );
      },
  );
  const submit = useCallback<typeof schema.submit>(
    settings => {
      prepare();
      return schemaRef.current.submit(settings);
    },
    [prepare],
  );
  return { queryForm: { ...schema, Form, submit, updateFields }, tableState, query, reset, reload, cancel };
}
