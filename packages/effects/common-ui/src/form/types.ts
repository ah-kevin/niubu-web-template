import type * as React from 'react';
import type {
  Control,
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldPathValue,
  FieldValues,
} from 'react-hook-form';
import type { z } from 'zod';
import type { SelectProps } from '@niubu/shadcn-ui/select';

export type BuiltinFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'password'
  | 'select'
  | 'checkbox'
  | 'checkbox-group'
  | 'radio'
  | 'switch'
  | 'date'
  | 'date-range';
export type CustomFieldKind = `custom:${string}`;
/** Keys include the custom: prefix; supplying a concrete map checks its params at the call site. */
export type CustomFieldParams = Record<CustomFieldKind, object>;
export type FieldOption = { value: string; label: string; disabled?: boolean };
export type BuiltinComponentProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  options?: readonly FieldOption[];
  valueMode?: 'number' | 'string';
  rows?: number;
  placeholder?: string;
  onValueChange?: SelectProps['onValueChange'];
};
export type FieldKindConfig<C extends CustomFieldParams = CustomFieldParams> =
  | { kind: BuiltinFieldKind; componentProps?: BuiltinComponentProps }
  | { [K in keyof C & CustomFieldKind]: { kind: K; componentProps?: C[K] } }[keyof C & CustomFieldKind];
export type FieldAccessibilityProps = {
  id: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
};
export type ResolveFieldMessage = (message: string) => string;
export type FieldPresentation = {
  label: string;
  description?: string;
  unit?: string;
  required?: boolean;
  disabled?: boolean;
  resolveMessage?: ResolveFieldMessage;
};
export type FieldDependencyResult = {
  visible?: boolean;
  disabled?: boolean;
  required?: boolean;
  schema?: z.ZodType;
  componentProps?: object;
};
export type FieldDependencies<V extends FieldValues> = {
  fields: readonly FieldPath<V>[];
  derive: (values: Readonly<V>) => FieldDependencyResult;
};
export type FormFieldConfig<
  V extends FieldValues,
  C extends CustomFieldParams = CustomFieldParams,
> = FieldPresentation &
  FieldKindConfig<C> & {
    name: FieldPath<V>;
    schema?: z.ZodType;
    defaultValue?: FieldPathValue<V, FieldPath<V>>;
    colSpan?: number;
    group?: string;
    sensitive?: boolean;
    dependencies?: FieldDependencies<V>;
  };
export type PartialFieldPatch<V extends FieldValues, C extends CustomFieldParams = CustomFieldParams> = {
  name: FieldPath<V>;
} & Partial<Omit<FormFieldConfig<V, C>, 'name'>>;
export type FormGroup = { id: string; title: string; description?: string };
export type FormLayout = { columns: number; labelWidth: number | string; collapsedRows?: number };
export type CustomFieldRenderProps<
  V extends FieldValues,
  N extends FieldPath<V> = FieldPath<V>,
  P extends object = object,
> = {
  field: ControllerRenderProps<V, N>;
  fieldState: ControllerFieldState;
  shell: FieldAccessibilityProps;
  params: P;
  disabled?: boolean;
};
export type CustomFieldRegistry<V extends FieldValues, C extends CustomFieldParams = CustomFieldParams> = {
  readonly [K in keyof C & CustomFieldKind]: (props: CustomFieldRenderProps<V, FieldPath<V>, C[K]>) => React.ReactNode;
};
export type ControlledFieldProps<
  V extends FieldValues,
  N extends FieldPath<V> = FieldPath<V>,
  C extends CustomFieldParams = CustomFieldParams,
> = FieldPresentation &
  FieldKindConfig<C> & {
    control: Control<V>;
    name: N;
    customFields?: CustomFieldRegistry<V, C>;
  };
