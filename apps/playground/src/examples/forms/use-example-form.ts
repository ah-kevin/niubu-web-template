import {
  useSchemaForm,
  type CustomFieldParams,
  type SchemaFormApi,
  type SchemaFormOptions,
} from '@niubu/common-ui/form';

/** Example-local composition: schema owns validation/submission, presentation reads live locale.
 * Locale changes never call updateFields, which would retire the pending submit lease. */
export function useExampleForm<
  V extends Record<string, unknown>,
  O = ReturnType<SchemaFormApi<V>['toOutput']>,
  C extends CustomFieldParams = CustomFieldParams,
>(options: SchemaFormOptions<V, O, C>) {
  const schema = useSchemaForm<V, O, C>(options);
  return {
    ...schema,
    presentation: { fields: options.fields, layout: options.layout, customFields: options.customFields },
  };
}
