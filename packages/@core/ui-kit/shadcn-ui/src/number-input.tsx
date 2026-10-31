import * as React from 'react';
import { Minus, Plus } from '@niubu/icons';
import { Input } from './input';
import { cn } from './cn';

type InputProps = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange'>;
export type NumberInputProps = InputProps &
  (
    | { valueMode?: 'number'; value: number | null; onValueChange: (value: number | null) => void }
    | { valueMode: 'string'; value: string; onValueChange: (value: string) => void }
  ) & (
    | { controls?: false; decreaseLabel?: never; increaseLabel?: never; unit?: never }
    | { controls: true; decreaseLabel: string; increaseLabel: string; unit?: string }
  );
export function NumberInput({ valueMode = 'number', value, onValueChange, controls = false, decreaseLabel,
  increaseLabel, unit, className, ref, disabled, readOnly, min, max, step, ...props }: NumberInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const unitId = React.useId();
  React.useImperativeHandle(ref, () => inputRef.current!);
  const emit = (raw: string, numeric: number) => {
    if (valueMode === 'string') (onValueChange as (value: string) => void)(raw);
    else (onValueChange as (value: number | null) => void)(raw.trim() === '' || !Number.isFinite(numeric) ? null : numeric);
  };
  const change = (direction: 'up' | 'down') => {
    const input = inputRef.current;
    if (!input || disabled || readOnly || step === 'any') return;
    const before = input.value;
    if (direction === 'up') input.stepUp(); else input.stepDown();
    const next = input.value;
    const numeric = input.valueAsNumber;
    // The parent remains the owner even if it rejects the proposed value.
    input.value = before;
    if (next !== before) emit(next, numeric);
  };
  const numeric = value === null || value === '' ? NaN : Number(value);
  const input = <Input {...props} ref={inputRef} disabled={disabled} readOnly={readOnly} min={min} max={max} step={step}
    type="number" value={value ?? ''} aria-describedby={[props['aria-describedby'], unit ? unitId : undefined].filter(Boolean).join(' ') || undefined}
    className={controls ? 'min-w-0 flex-1 rounded-none border-x-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none' : className}
    onChange={event => emit(event.currentTarget.value, event.currentTarget.valueAsNumber)} />;
  if (!controls) return input;
  const buttonClass = 'flex w-[var(--control-height)] shrink-0 items-center justify-center border-y border-input group-aria-invalid/number:border-destructive bg-card text-foreground outline-none enabled:hover:bg-muted enabled:active:bg-border focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-disabled-foreground';
  const locked = disabled || readOnly || step === 'any';
  return <div data-slot="number-input" aria-invalid={props['aria-invalid']} className={cn('group/number flex w-full min-w-0', className)}>
    <button type="button" aria-label={decreaseLabel} aria-controls={props.id} className={cn(buttonClass, 'rounded-l-[var(--control-radius)] border-x')}
      disabled={locked || (min !== undefined && Number.isFinite(numeric) && numeric <= Number(min))}
      onMouseDown={event => event.preventDefault()} onClick={() => change('down')}><Minus aria-hidden className="size-4" /></button>
    {input}
    {unit && <span id={unitId} data-slot="number-input-unit" className={cn("inline-flex items-center border-y border-input px-2 group-focus-within/number:border-ring group-aria-invalid/number:border-destructive", disabled ? "bg-muted text-disabled-foreground" : "bg-card text-muted-foreground")}>{unit}</span>}
    <button type="button" aria-label={increaseLabel} aria-controls={props.id} className={cn(buttonClass, 'rounded-r-[var(--control-radius)] border-x')}
      disabled={locked || (max !== undefined && Number.isFinite(numeric) && numeric >= Number(max))}
      onMouseDown={event => event.preventDefault()} onClick={() => change('up')}><Plus aria-hidden className="size-4" /></button>
  </div>;
}
