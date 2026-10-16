import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';
import { assertCustomFields, getCustomFieldRenderer, isBuiltinFieldKind } from './registry';
import { copyValue, hasPath, pathParts, readPath, readonlyValues, sameValueTypes, writePath } from './transforms';
import type { CustomFieldParams, FieldDependencyResult, FormFieldConfig } from './types';
export type ResolvedField<V extends FieldValues, C extends CustomFieldParams> = FormFieldConfig<V, C> & {
  visible: boolean;
};
export function assertFieldConfiguration<V extends FieldValues, C extends CustomFieldParams>(
  fields: readonly FormFieldConfig<V, C>[],
  customFields?: object,
  defaults?: unknown,
) {
  assertCustomFields(customFields);
  const byName = new Map<string, FormFieldConfig<V, C>>();
  for (const field of fields) {
    pathParts(field.name);
    if (byName.has(field.name)) throw new Error(`Duplicate field: ${field.name}`);
    byName.set(field.name, field);
    if (!isBuiltinFieldKind(field.kind)) getCustomFieldRenderer(field.kind, customFields);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  function visit(name: string) {
    if (visiting.has(name)) throw new Error(`Field dependency cycle: ${name}`);
    if (done.has(name)) return;
    visiting.add(name);
    const seen = new Set<string>();
    for (const dependency of byName.get(name)?.dependencies?.fields ?? []) {
      pathParts(dependency);
      if (seen.has(dependency)) throw new Error(`Duplicate dependency: ${dependency}`);
      seen.add(dependency);
      const exact = byName.get(dependency);
      const owners = exact
        ? [exact.name]
        : [...byName.values()]
            .filter(candidate => {
              if (candidate.name.startsWith(`${dependency}.`)) return true;
              if (!dependency.startsWith(`${candidate.name}.`)) return false;
              const suffix = dependency.slice(candidate.name.length + 1);
              if (candidate.kind === 'date-range') return suffix === 'start' || suffix === 'end';
              if (candidate.kind === 'checkbox-group') return /^\d+$/.test(suffix);
              return (
                candidate.kind.startsWith('custom:') &&
                hasPath(defaults ?? candidate.defaultValue, defaults ? dependency : suffix)
              );
            })
            .map(candidate => candidate.name);
      if (!owners.length) throw new Error(`Unknown dependency: ${dependency}`);
      for (const owner of owners) visit(owner);
    }
    visiting.delete(name);
    done.add(name);
  }
  for (const name of byName.keys()) visit(name);
}
export function resolveFields<V extends FieldValues, C extends CustomFieldParams>(
  fields: readonly FormFieldConfig<V, C>[],
  values: V,
): ResolvedField<V, C>[] {
  let snapshot: Readonly<V> | undefined;
  return fields.map(field => {
    const dynamic: FieldDependencyResult = field.dependencies
      ? field.dependencies.derive((snapshot ??= readonlyValues(values)))
      : {};
    if (!dynamic || typeof dynamic !== 'object' || 'then' in dynamic)
      throw new Error('Field dependencies must be synchronous pure calculations');
    const allowed = new Set(['visible', 'disabled', 'required', 'schema', 'componentProps']);
    if (Object.keys(dynamic).some(key => !allowed.has(key))) throw new Error('Unsupported field dependency result');
    return {
      ...field,
      ...dynamic,
      visible: dynamic.visible !== false,
      componentProps: { ...field.componentProps, ...dynamic.componentProps },
    } as ResolvedField<V, C>;
  });
}
function parseSync(schema: z.ZodType, value: unknown) {
  try {
    const parsed = schema.safeParse(copyValue(value));
    if (parsed.success && !sameValueTypes(value, parsed.data))
      throw new Error('Schema transforms must not change value types; use the explicit output transform');
    return parsed;
  } catch (error) {
    if (error instanceof Error && /promise|async/i.test(error.message))
      throw new Error('SchemaForm requires synchronous Zod validation', { cause: error });
    throw error;
  }
}
function empty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && !value.length) ||
    (!!value &&
      typeof value === 'object' &&
      Object.hasOwn(value, 'start') &&
      (!readPath(value, 'start') || !readPath(value, 'end')))
  );
}
export function schemaResolver<V extends FieldValues, C extends CustomFieldParams>(
  getFields: () => readonly FormFieldConfig<V, C>[],
  schema?: z.ZodType<V, V>,
  onErrors?: (errors: FieldErrors<V>) => void,
): Resolver<V> {
  return values => {
    const fields = resolveFields(getFields(), values);
    const errors: FieldErrors<V> = {};
    function issue(path: string, message: string, type = 'validate') {
      const safePath = path || 'root';
      if (!readPath(errors, safePath)) writePath(errors, safePath, { type, message });
    }
    for (const field of fields) {
      if (!field.visible) continue;
      const value = readPath(values, field.name);
      if (field.schema) {
        const parsed = parseSync(field.schema, value);
        if (!parsed.success)
          for (const error of parsed.error.issues)
            issue([field.name, ...error.path].join('.'), error.message, error.code);
      }
    }
    if (schema) {
      const parsed = parseSync(schema, values);
      if (!parsed.success)
        for (const error of parsed.error.issues) {
          const path = error.path.join('.');
          const hidden =
            path && fields.some(field => !field.visible && (path === field.name || path.startsWith(`${field.name}.`)));
          if (!hidden) issue(path, error.message, error.code);
        }
    }
    // Specific field and original root messages take priority over a generic required fallback.
    for (const field of fields)
      if (field.visible && field.required && empty(readPath(values, field.name)))
        issue(field.name, 'validation:checkField', 'required');
    onErrors?.(errors);
    return Object.keys(errors).length ? { values: {}, errors } : { values, errors: {} };
  };
}
