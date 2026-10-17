import {
  useController,
  useFormState,
  get,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Label } from '@niubu/shadcn-ui/label';
import { Input } from '@niubu/shadcn-ui/input';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { RadioGroup, RadioGroupItem } from '@niubu/shadcn-ui/radio-group';
import { Select } from '@niubu/shadcn-ui/select';
import { Switch } from '@niubu/shadcn-ui/switch';
import { Textarea } from '@niubu/shadcn-ui/textarea';
import { useTranslation } from '@niubu/locales/react';
import { FieldShell } from './FieldShell';
import { assertCustomFields, getCustomFieldRenderer, isBuiltinFieldKind } from './registry';
import type {
  BuiltinComponentProps,
  ControlledFieldProps,
  CustomFieldParams,
  CustomFieldRenderProps,
  FieldAccessibilityProps,
} from './types';

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function rangeValue(value: unknown): { start: string; end: string } {
  if (!value || typeof value !== 'object') return { start: '', end: '' };
  return { start: stringValue(Reflect.get(value, 'start')), end: stringValue(Reflect.get(value, 'end')) };
}
function DateRange<V extends FieldValues, N extends FieldPath<V>>({
  control,
  field,
  shell,
  disabled,
  componentProps,
}: {
  control: Control<V>;
  field: ControllerRenderProps<V, N>;
  shell: FieldAccessibilityProps;
  disabled?: boolean;
  componentProps: BuiltinComponentProps;
}) {
  const { t } = useTranslation();
  const start = useController({ control, name: `${field.name}.start` as FieldPath<V> });
  const end = useController({ control, name: `${field.name}.end` as FieldPath<V> });
  const range = rangeValue(field.value);
  return (
    <div
      className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3"
      role="group"
      aria-labelledby={shell['aria-labelledby']}
    >
      {(['start', 'end'] as const).map(part => {
        const child = part === 'start' ? start : end;
        return (
          <div className="grid min-w-0 gap-1.5" key={part}>
            <Label
              id={`${shell.id}-${part}-label`}
              htmlFor={part === 'start' ? shell.id : `${shell.id}-end`}
              className="text-xs text-muted-foreground"
            >
              {t(part === 'start' ? 'common:form.rangeStart' : 'common:form.rangeEnd')}
            </Label>
            <Input
              {...componentProps}
              {...shell}
              key={part}
              type="date"
              id={part === 'start' ? shell.id : `${shell.id}-end`}
              aria-labelledby={`${shell['aria-labelledby']} ${shell.id}-${part}-label`}
              name={child.field.name}
              ref={node => {
                child.field.ref(node);
                if (part === 'start') field.ref(node);
              }}
              disabled={disabled}
              value={range[part]}
              onChange={event => field.onChange({ ...range, [part]: event.currentTarget.value })}
              onBlur={field.onBlur}
            />
          </div>
        );
      })}
    </div>
  );
}
export function ControlledField<
  V extends FieldValues,
  N extends FieldPath<V>,
  C extends CustomFieldParams = CustomFieldParams,
>(props: ControlledFieldProps<V, N, C>) {
  const { control, name, kind, label, description, unit, required, disabled, resolveMessage, customFields } = props;
  // Disabled is presentation only: RHF must retain this value in submissions and validation.
  const { field, fieldState } = useController({ control, name });
  assertCustomFields(customFields);
  const componentProps = (props.componentProps ?? {}) as BuiltinComponentProps;
  // Strip app binding handlers before supplying the authoritative controller bindings below.
  const {
    value: _value,
    defaultValue: _defaultValue,
    onChange: _onChange,
    onBlur: _onBlur,
    ref: _ref,
    name: _name,
    options = [],
    valueMode,
    onValueChange: _onValueChange,
    ...inputProps
  } = componentProps;
  void [_value, _defaultValue, _onChange, _onBlur, _ref, _name, _onValueChange];
  // A range shares one shell; nested leaf errors must also update its description.
  const { errors } = useFormState({ control, name, exact: kind !== 'date-range' });
  const nestedError = get(errors, name) as
    { message?: string; start?: { message?: string }; end?: { message?: string } } | undefined;
  const error = nestedError?.message ?? nestedError?.start?.message ?? nestedError?.end?.message;
  const firstEnabledOption = options.findIndex(option => !option.disabled);
  const selectedEnabledOption = options.findIndex(option => !option.disabled && option.value === field.value);
  const radioFocusOption = selectedEnabledOption < 0 ? firstEnabledOption : selectedEnabledOption;
  return (
    <FieldShell
      label={label}
      description={description}
      unit={unit}
      required={required}
      error={error}
      resolveMessage={resolveMessage}
    >
      {shell => {
        const binding = { ...shell, name: field.name, ref: field.ref, onBlur: field.onBlur, disabled: !!disabled };
        if (!isBuiltinFieldKind(kind)) {
          const CustomRenderer = getCustomFieldRenderer(kind, customFields) as (
            props: CustomFieldRenderProps<V, N, object>,
          ) => React.ReactNode;
          return (
            <CustomRenderer
              field={field}
              fieldState={fieldState}
              shell={shell}
              params={props.componentProps ?? {}}
              disabled={disabled}
            />
          );
        }
        switch (kind) {
          case 'textarea':
            return (
              <Textarea
                {...(inputProps as React.ComponentProps<'textarea'>)}
                {...binding}
                value={stringValue(field.value)}
                onChange={field.onChange}
              />
            );
          case 'number':
            return valueMode === 'string' ? (
              <NumberInput
                {...inputProps}
                {...binding}
                valueMode="string"
                value={stringValue(field.value)}
                onValueChange={field.onChange}
              />
            ) : (
              <NumberInput
                {...inputProps}
                {...binding}
                valueMode="number"
                value={typeof field.value === 'number' && Number.isFinite(field.value) ? field.value : null}
                onValueChange={field.onChange}
              />
            );
          case 'select':
            return (
              <Select
                {...(inputProps as React.ComponentProps<typeof Select>)}
                {...binding}
                type="button"
                className={['w-full min-w-0', inputProps.className].filter(Boolean).join(' ')}
                label={label}
                value={stringValue(field.value)}
                onValueChange={field.onChange}
                options={options}
              />
            );
          case 'checkbox':
            return (
              <Checkbox
                {...(inputProps as React.ComponentProps<typeof Checkbox>)}
                {...binding}
                checked={field.value === true}
                onCheckedChange={checked => field.onChange(checked === true)}
              />
            );
          case 'switch':
            return (
              <Switch
                {...(inputProps as React.ComponentProps<typeof Switch>)}
                {...binding}
                checked={field.value === true}
                onCheckedChange={checked => field.onChange(checked === true)}
              />
            );
          case 'checkbox-group': {
            const selected = Array.isArray(field.value) ? (field.value as string[]) : [];
            return (
              <div role="group" aria-labelledby={shell['aria-labelledby']} aria-describedby={shell['aria-describedby']}>
                {options.map((option, index) => (
                  <Label className="flex items-center gap-2" key={option.value} htmlFor={`${shell.id}-${index}`}>
                    <Checkbox
                      {...(inputProps as React.ComponentProps<typeof Checkbox>)}
                      {...binding}
                      id={`${shell.id}-${index}`}
                      aria-labelledby={undefined}
                      aria-label={option.label}
                      ref={index === firstEnabledOption ? field.ref : undefined}
                      disabled={disabled || option.disabled}
                      checked={selected.includes(option.value)}
                      onCheckedChange={checked =>
                        field.onChange(
                          checked === true
                            ? [...selected.filter(item => item !== option.value), option.value]
                            : selected.filter(item => item !== option.value),
                        )
                      }
                    />
                    {option.label}
                  </Label>
                ))}
              </div>
            );
          }
          case 'radio':
            return (
              <RadioGroup
                {...(inputProps as React.ComponentProps<typeof RadioGroup>)}
                {...shell}
                name={field.name}
                disabled={disabled}
                value={stringValue(field.value)}
                onValueChange={field.onChange}
              >
                {options.map((option, index) => (
                  <Label className="flex items-center gap-2" key={option.value} htmlFor={`${shell.id}-${index}`}>
                    <RadioGroupItem
                      {...shell}
                      aria-labelledby={undefined}
                      aria-label={option.label}
                      id={`${shell.id}-${index}`}
                      name={field.name}
                      ref={index === radioFocusOption ? field.ref : undefined}
                      value={option.value}
                      disabled={disabled || option.disabled}
                      onBlur={field.onBlur}
                    />
                    {option.label}
                  </Label>
                ))}
              </RadioGroup>
            );
          case 'date-range':
            return (
              <DateRange
                control={control}
                field={field}
                shell={shell}
                disabled={disabled}
                componentProps={inputProps}
              />
            );
          default:
            return (
              <Input
                {...inputProps}
                {...binding}
                type={kind === 'password' ? 'password' : kind === 'date' ? 'date' : 'text'}
                value={stringValue(field.value)}
                onChange={field.onChange}
              />
            );
        }
      }}
    </FieldShell>
  );
}
