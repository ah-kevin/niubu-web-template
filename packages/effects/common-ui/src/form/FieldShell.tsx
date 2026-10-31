import { useId, type ReactNode } from 'react';
import { CircleAlert } from '@niubu/icons';
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
    <div className="schema-field grid min-w-0 gap-1">
      <div className="schema-field-heading flex items-baseline gap-1 text-[length:var(--control-font-size)] font-normal">
        <Label className="font-normal" id={labelId} htmlFor={id}>
          {label}
        </Label>
        {unit && <span className="schema-field-unit text-xs text-muted-foreground">{unit}</span>}
        {required && (
          <span aria-hidden="true" className="text-destructive-text">
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
      <div className="schema-field-message min-h-[var(--caption-line-height)]">
        {message && (
          <p
            id={errorId}
            role="alert"
            className="schema-field-error m-0 flex items-start gap-1 text-xs leading-[18px] text-destructive-text"
          >
            <CircleAlert aria-hidden="true" className="size-[var(--control-icon-size)] shrink-0" />
            <span>{message}</span>
          </p>
        )}
      </div>
    </div>
  );
}
