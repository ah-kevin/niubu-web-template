import { useId, type ReactNode } from 'react';
import { Label } from '@niubu/shadcn-ui/label';
import type { FieldAccessibilityProps, FieldPresentation } from './types';
export type FieldShellProps = FieldPresentation & {
  id?: string;
  error?: string;
  children: (accessibility: FieldAccessibilityProps) => ReactNode;
};
export function FieldShell({
  id: suppliedId,
  label,
  description,
  unit,
  required,
  error,
  resolveMessage,
  children,
}: FieldShellProps) {
  const uniqueId = useId();
  const id = suppliedId ?? `field-${uniqueId}`;
  const labelId = `${id}-label`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [description && helpId, error && errorId].filter(Boolean).join(' ') || undefined;
  const message = error ? (resolveMessage?.(error) ?? error) : undefined;
  return (
    <div className="schema-field grid min-w-0 gap-[0.4rem]">
      <div className="schema-field-heading flex items-baseline gap-[0.3rem] text-sm font-medium">
        <Label id={labelId} htmlFor={id}>
          {label}
        </Label>
        {unit && <span className="schema-field-unit text-xs text-muted-foreground">{unit}</span>}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            {' '}
            *
          </span>
        )}
      </div>
      {children({
        id,
        'aria-labelledby': labelId,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
        'aria-invalid': !!error,
      })}
      {description && (
        <p id={helpId} className="schema-field-help m-0 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {message && (
        <p id={errorId} role="alert" className="schema-field-error m-0 text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
