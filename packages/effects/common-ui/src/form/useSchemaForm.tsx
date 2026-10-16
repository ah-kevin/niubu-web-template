import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  useForm,
  type DeepPartial,
  type DefaultValues,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
} from 'react-hook-form';
import { SchemaForm } from './SchemaForm';
import { SchemaFields } from './SchemaFields';
import { createSchemaConfiguration } from './schema-runtime';
import { focusFirstInvalidControl } from './focus';
import { createOperationOwner } from './operation';
import { copyValue, hasPath, initialValues, isSensitive, mergeValue, projectValues, readPath } from './transforms';
import { assertFieldConfiguration, resolveFields, schemaResolver } from './validation';
import type { CustomFieldParams, FormFieldConfig, PartialFieldPatch } from './types';
import type {
  SchemaFieldsProps,
  SchemaFormApi,
  SchemaFormOptions,
  SchemaFormProps,
  SchemaRenderModel,
  SchemaValidationResult,
} from './schema-types';

function createBindings<V extends FieldValues, C extends CustomFieldParams>() {
  let model: SchemaRenderModel<V, C> | null = null;
  const listeners = new Set<() => void>();
  const read = () => model;
  const subscribe = (callback: () => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };
  return {
    publish(next: SchemaRenderModel<V, C>) {
      model = next;
      for (const listener of listeners) listener();
    },
    Form: function BoundSchemaForm(props: SchemaFormProps) {
      const current = useSyncExternalStore(subscribe, read, read);
      const element = useRef<HTMLDivElement>(null);
      useEffect(() => {
        if (!current?.focusRequest?.current()) return;
        if (element.current) focusFirstInvalidControl(element.current, current.form.getFieldState);
        current.completeFocus(current.focusRequest);
      }, [current]);
      return (
        current && (
          <div ref={element}>
            <SchemaForm {...props} model={current} />
          </div>
        )
      );
    },
    Fields: function BoundSchemaFields(props: SchemaFieldsProps<V>) {
      const current = useSyncExternalStore(subscribe, read, read);
      return current && <SchemaFields {...props} model={current} />;
    },
  };
}

export function useSchemaForm<
  V extends FieldValues,
  O = DeepPartial<V>,
  C extends CustomFieldParams = CustomFieldParams,
>(options: SchemaFormOptions<V, O, C>): SchemaFormApi<V, O, C> {
  const [initial] = useState(() => {
    const baseline = initialValues(options.fields, options.defaultValues);
    assertFieldConfiguration(options.fields, options.customFields, baseline);
    return {
      fields: options.fields.map(field => ({ ...field })),
      defaults: baseline,
      schema: options.schema,
      customFields: options.customFields,
    };
  });
  const [fields, setFields] = useState<readonly FormFieldConfig<V, C>[]>(initial.fields);
  const [configVersion, setConfigVersion] = useState(0);
  const [configuration] = useState(() => createSchemaConfiguration<V, C>(initial.fields));
  const [operations] = useState(createOperationOwner);
  const [resolver] = useState(() =>
    schemaResolver(configuration.getFields, initial.schema, configuration.recordErrors),
  );
  const form = useForm<V>({
    defaultValues: initial.defaults,
    resolver,
    mode: 'onSubmit',
    shouldFocusError: false,
    shouldUnregister: false,
  });
  const currentOptions = useRef(options);
  useLayoutEffect(() => {
    currentOptions.current = options;
  }, [options]);
  const mounted = useRef(true);
  const [focusRequest, setFocusRequest] = useState<import('./operation').OperationLease | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operations.cancel();
    };
  }, [operations]);
  useEffect(
    () => form.subscribe({ formState: { values: true }, callback: () => operations.cancel() }),
    [form, operations],
  );
  const cancel = operations.cancel;
  const getValues = form.getValues;
  const validate = useCallback(async (): Promise<SchemaValidationResult<V>> => {
    const values = copyValue(form.getValues());
    const validation = form.trigger(undefined, { shouldFocus: false });
    const errors = configuration.getErrors();
    const valid = await validation;
    return valid ? { valid: true, values } : { valid: false, errors };
  }, [form, configuration]);
  // Subscribe so the imperative validate result always reads current errors.
  void form.formState.errors;
  void form.formState.isDirty;
  const filterDraft = useCallback(
    (values: V) =>
      projectValues(values, configuration.getFields(), field => !isSensitive(field), true, initial.defaults),
    [configuration, initial.defaults],
  );
  const publicValues = useCallback(
    (values: V) => {
      const resolved = resolveFields(configuration.getFields(), values);
      return projectValues(values, resolved, field => field.visible && !isSensitive(field));
    },
    [configuration],
  );
  const toOutput = useCallback(
    (values: V): O => {
      const resolved = resolveFields(configuration.getFields(), values);
      const projected = projectValues(values, resolved, field => field.visible);
      return currentOptions.current.transform ? currentOptions.current.transform(projected) : (projected as O);
    },
    [configuration],
  );
  const reset = useCallback(
    (values?: DefaultValues<V>) => {
      operations.cancel();
      if (values) form.reset(initialValues(configuration.getFields(), values));
      else form.reset();
    },
    [form, operations, configuration],
  );
  const setValues = useCallback(
    (patch: DeepPartial<V>, settings?: { shouldDirty?: boolean }) => {
      operations.cancel();
      const safe = projectValues(
        patch as V,
        configuration.getFields(),
        field => !isSensitive(field),
        true,
        initial.defaults,
      );
      for (const field of configuration.getFields())
        if (hasPath(safe, field.name)) {
          const value = readPath(safe, field.name);
          if (field.kind === 'date-range') {
            for (const part of ['start', 'end'])
              if (hasPath(value, part))
                form.setValue(
                  `${field.name}.${part}` as FieldPath<V>,
                  readPath(value, part) as FieldPathValue<V, FieldPath<V>>,
                  { shouldDirty: settings?.shouldDirty ?? false },
                );
          } else
            form.setValue(
              field.name,
              mergeValue(readPath(form.getValues(), field.name), value) as FieldPathValue<V, FieldPath<V>>,
              {
                shouldDirty: settings?.shouldDirty ?? false,
              },
            );
        }
    },
    [form, operations, configuration, initial.defaults],
  );
  const updateFields = useCallback(
    (patches: readonly PartialFieldPatch<V, C>[]) => {
      if (!patches.length) return;
      const names = new Set<string>();
      for (const patch of patches) {
        if (!configuration.getFields().some(field => field.name === patch.name))
          throw new Error(`Cannot patch unknown field: ${patch.name}`);
        if (names.has(patch.name)) throw new Error(`Duplicate field patch: ${patch.name}`);
        names.add(patch.name);
      }
      const next = configuration
        .getFields()
        .map(field => ({ ...field, ...patches.find(patch => patch.name === field.name) }) as FormFieldConfig<V, C>);
      assertFieldConfiguration(next, initial.customFields, form.getValues());
      operations.cancel();
      configuration.replaceFields(next);
      setFields(next);
      setConfigVersion(version => version + 1);
    },
    [initial.customFields, operations, configuration, form],
  );
  const submit = useCallback(
    async (settings?: { signal?: AbortSignal }) => {
      const lease = operations.begin(settings?.signal);
      if (!mounted.current || !lease.current()) return 'cancelled' as const;
      // Capture both callbacks before awaiting; a parent render alone does not change this operation.
      const handler = currentOptions.current.onSubmit;
      const transform = currentOptions.current.transform;
      try {
        const outcome = await validate();
        if (!mounted.current || !lease.current()) return 'cancelled' as const;
        if (!outcome.valid) {
          setFocusRequest(lease);
          return 'invalid' as const;
        }
        if (!handler) {
          operations.complete(lease);
          return 'validated' as const;
        }
        const projected = projectValues(
          outcome.values,
          resolveFields(configuration.getFields(), outcome.values),
          field => field.visible,
        );
        await handler(transform ? transform(projected) : (projected as O), { signal: lease.signal });
        if (!mounted.current || !operations.complete(lease)) return 'cancelled' as const;
        return 'submitted' as const;
      } catch {
        if (!lease.current() || !mounted.current) return 'cancelled' as const;
        operations.complete(lease);
        return 'error' as const;
      }
    },
    [operations, validate, configuration],
  );
  const renderModel = {
    form,
    fields,
    customFields: initial.customFields,
    groups: options.groups,
    layout: options.layout,
    submit,
    reset,
    focusRequest,
    completeFocus: operations.complete,
  };
  const [components] = useState(() => createBindings<V, C>());
  useLayoutEffect(() => {
    components.publish(renderModel);
  });
  return {
    form,
    Form: components.Form,
    Fields: components.Fields,
    getValues,
    setValues,
    validate,
    reset,
    updateFields,
    toOutput,
    filterDraft,
    publicValues,
    submit,
    cancel,
    configVersion,
  };
}
