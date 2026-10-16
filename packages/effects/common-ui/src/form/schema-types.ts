import type { ComponentType, ReactNode } from 'react';
import type { DeepPartial, DefaultValues, FieldErrors, FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import type { OperationLease } from './operation';
import type {
  CustomFieldParams,
  CustomFieldRegistry,
  FormFieldConfig,
  FormGroup,
  FormLayout,
  PartialFieldPatch,
} from './types';

export type SchemaSubmitResult = 'submitted' | 'validated' | 'invalid' | 'cancelled' | 'error';
export type SchemaValidationResult<V extends FieldValues> =
  { valid: true; values: V } | { valid: false; errors: FieldErrors<V> };
export type SchemaFormProps = {
  id?: string;
  className?: string;
  children?: ReactNode;
  submitLabel?: string;
  resetLabel?: string;
  showActions?: boolean;
};
export type SchemaFieldsProps<V extends FieldValues> = { className?: string; names?: readonly FieldPath<V>[] };
type TransformOption<V extends FieldValues, O> = [O] extends [DeepPartial<V>]
  ? [DeepPartial<V>] extends [O]
    ? { transform?: (visibleValues: DeepPartial<V>) => O }
    : { transform: (visibleValues: DeepPartial<V>) => O }
  : { transform: (visibleValues: DeepPartial<V>) => O };
/** fields/defaultValues/schema/customFields initialize one owner. Use updateFields for later field changes.
 * groups/layout and onSubmit/transform use the current render; inline metadata does not restart saves.
 * A semantic transform/onSubmit change during an operation must be paired with cancel or a field patch.
 */
export type SchemaFormOptions<
  V extends FieldValues,
  O = DeepPartial<V>,
  C extends CustomFieldParams = CustomFieldParams,
> = {
  fields: readonly FormFieldConfig<V, C>[];
  defaultValues?: DefaultValues<V>;
  schema?: z.ZodType<V, V>;
  groups?: readonly FormGroup[];
  layout?: FormLayout;
  customFields?: CustomFieldRegistry<V, C>;
  onSubmit?: (output: O, context: { signal: AbortSignal }) => Promise<void>;
} & TransformOption<V, O>;
export type SchemaFormApi<
  V extends FieldValues,
  O = DeepPartial<V>,
  C extends CustomFieldParams = CustomFieldParams,
> = {
  form: UseFormReturn<V>;
  Form: ComponentType<SchemaFormProps>;
  Fields: ComponentType<SchemaFieldsProps<V>>;
  getValues: () => V;
  setValues: (patch: DeepPartial<V>, options?: { shouldDirty?: boolean }) => void;
  validate: () => Promise<SchemaValidationResult<V>>;
  reset: (values?: DefaultValues<V>) => void;
  updateFields: (patches: readonly PartialFieldPatch<V, C>[]) => void;
  toOutput: (values: V) => O;
  filterDraft: (values: V) => DeepPartial<V>;
  publicValues: (values: V) => DeepPartial<V>;
  submit: (options?: { signal?: AbortSignal }) => Promise<SchemaSubmitResult>;
  cancel: () => void;
  configVersion: number;
};
export type SchemaRenderModel<V extends FieldValues, C extends CustomFieldParams> = {
  form: UseFormReturn<V>;
  fields: readonly FormFieldConfig<V, C>[];
  customFields?: CustomFieldRegistry<V, C>;
  groups?: readonly FormGroup[];
  layout?: FormLayout;
  submit: () => Promise<SchemaSubmitResult>;
  reset: () => void;
  focusRequest: OperationLease | null;
  completeFocus: (lease: OperationLease) => boolean;
};
