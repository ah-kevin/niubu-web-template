import type { FieldErrors, FieldValues } from 'react-hook-form';
import type { CustomFieldParams, FormFieldConfig } from './types';

/** Imperative resolver configuration, separate from React's render snapshot. */
export function createSchemaConfiguration<V extends FieldValues, C extends CustomFieldParams>(
  initial: readonly FormFieldConfig<V, C>[],
) {
  let fields = initial;
  let errors: FieldErrors<V> = {};
  return {
    getFields: () => fields,
    replaceFields: (next: readonly FormFieldConfig<V, C>[]) => {
      fields = next;
    },
    getErrors: () => errors,
    recordErrors: (next: FieldErrors<V>) => {
      errors = next;
    },
  };
}
