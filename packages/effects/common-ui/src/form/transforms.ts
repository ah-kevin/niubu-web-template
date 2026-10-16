import type { DeepPartial, DefaultValues, FieldValues } from 'react-hook-form';
import type { CustomFieldParams, FormFieldConfig } from './types';

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function pathParts(path: string): string[] {
  const parts = path.split('.');
  if (!parts.length || parts.some(part => !/^(?:[A-Za-z_$][\w$]*|0|[1-9]\d*)$/.test(part) || forbidden.has(part)))
    throw new Error(`Unsafe field path: ${path}`);
  return parts;
}
export function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of pathParts(path)) {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, part)) return undefined;
    current = Reflect.get(current, part);
  }
  return current;
}
export function hasPath(value: unknown, path: string): boolean {
  const parts = pathParts(path);
  const key = parts.pop()!;
  const parent = parts.length ? readPath(value, parts.join('.')) : value;
  return !!parent && typeof parent === 'object' && Object.hasOwn(parent, key);
}
export function writePath(target: object, path: string, value: unknown): void {
  const parts = pathParts(path);
  let current = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      Reflect.set(current, part, value);
      return;
    }
    if (!Object.hasOwn(current, part) || !Reflect.get(current, part) || typeof Reflect.get(current, part) !== 'object')
      Reflect.set(current, part, /^\d+$/.test(parts[index + 1]) ? [] : {});
    current = Reflect.get(current, part) as object;
  });
}
function deletePath(target: object, path: string) {
  const parts = pathParts(path);
  const key = parts.pop()!;
  const parent = parts.length ? readPath(target, parts.join('.')) : target;
  if (parent && typeof parent === 'object') Reflect.deleteProperty(parent, key);
}
export function copyValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => copyValue(item)) as T;
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) if (!forbidden.has(key)) result[key] = copyValue(Reflect.get(value, key));
    return result as T;
  }
  return value;
}
export function readonlyValues<V>(value: V): Readonly<V> {
  const copied = copyValue(value);
  function freeze(item: unknown) {
    if (item && typeof item === 'object') {
      Object.freeze(item);
      for (const child of Object.values(item)) freeze(child);
    }
  }
  freeze(copied);
  return copied;
}
export function emptyField<V extends FieldValues, C extends CustomFieldParams>(field: FormFieldConfig<V, C>): unknown {
  if (field.kind === 'checkbox' || field.kind === 'switch') return false;
  if (field.kind === 'checkbox-group') return [];
  if (field.kind === 'date-range') return { start: '', end: '' };
  if (field.kind === 'number' && Reflect.get(field.componentProps ?? {}, 'valueMode') !== 'string') return null;
  return '';
}
export function initialValues<V extends FieldValues, C extends CustomFieldParams>(
  fields: readonly FormFieldConfig<V, C>[],
  defaults?: DefaultValues<V>,
): DefaultValues<V> {
  const result = copyValue(defaults ?? {}) as object;
  for (const field of fields)
    if (!hasPath(result, field.name)) writePath(result, field.name, copyValue(field.defaultValue ?? emptyField(field)));
  return result as DefaultValues<V>;
}
export function sameValueTypes(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b))
    return Array.isArray(a) && Array.isArray(b) && b.every((item, i) => sameValueTypes(a[i], item));
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object' && typeof b === 'object')
    return Object.keys(b).every(
      key => Object.hasOwn(a, key) && sameValueTypes(Reflect.get(a, key), Reflect.get(b, key)),
    );
  return true;
}
function restoredValue<V extends FieldValues, C extends CustomFieldParams>(
  field: FormFieldConfig<V, C>,
  value: unknown,
  baselineValue?: unknown,
): { value: unknown } | undefined {
  if (field.kind === 'date-range') {
    if (!value || typeof value !== 'object') return;
    const start = readPath(value, 'start');
    const end = readPath(value, 'end');
    if ((start !== undefined && typeof start !== 'string') || (end !== undefined && typeof end !== 'string')) return;
    return { value: { ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}) } };
  }
  if (field.kind === 'checkbox-group')
    return Array.isArray(value) && value.every(v => typeof v === 'string') ? { value: [...value] } : undefined;
  if (field.kind === 'checkbox' || field.kind === 'switch') return typeof value === 'boolean' ? { value } : undefined;
  if (field.kind === 'number' && Reflect.get(field.componentProps ?? {}, 'valueMode') !== 'string')
    return value === null || (typeof value === 'number' && Number.isFinite(value)) ? { value } : undefined;
  if (!field.kind.startsWith('custom:')) return typeof value === 'string' ? { value } : undefined;
  const baseline = baselineValue ?? field.defaultValue ?? emptyField(field);
  return sameValueTypes(baseline, value) ? { value: copyValue(value) } : undefined;
}
/** Copy by configured paths. Never copy a parent merely to retain one child. */
export function projectValues<V extends FieldValues, C extends CustomFieldParams, F extends FormFieldConfig<V, C>>(
  values: V,
  fields: readonly F[],
  include: (field: F) => boolean,
  restore = false,
  baseline?: unknown,
): DeepPartial<V> {
  const result = {};
  for (const field of fields) {
    if (!include(field) || !hasPath(values, field.name)) continue;
    const value = readPath(values, field.name);
    if (restore) {
      const safe = restoredValue(field, value, baseline ? readPath(baseline, field.name) : undefined);
      if (safe) writePath(result, field.name, safe.value);
    } else if (field.kind === 'date-range') {
      for (const part of ['start', 'end'])
        if (hasPath(value, part)) writePath(result, `${field.name}.${part}`, copyValue(readPath(value, part)));
    } else writePath(result, field.name, copyValue(value));
  }
  // Parent/composite declarations may overlap a protected descendant.
  for (const field of fields) if (!include(field)) deletePath(result, field.name);
  return result as DeepPartial<V>;
}
export function isSensitive<V extends FieldValues, C extends CustomFieldParams>(field: FormFieldConfig<V, C>) {
  return field.kind === 'password' || field.sensitive === true;
}

/** Merge an explicit nested patch into raw values without replacing protected siblings. */
export function mergeValue(current: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return copyValue(patch);
  const result = current && typeof current === 'object' && !Array.isArray(current) ? copyValue(current) : {};
  for (const key of Object.keys(patch))
    if (!forbidden.has(key)) Reflect.set(result, key, mergeValue(readPath(result, key), Reflect.get(patch, key)));
  return result;
}
