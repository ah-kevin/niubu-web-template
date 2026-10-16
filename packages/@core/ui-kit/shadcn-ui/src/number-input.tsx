import * as React from 'react';
import { Input } from './input';
type InputProps = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange'>;
export type NumberInputProps = InputProps &
  (
    | { valueMode?: 'number'; value: number | null; onValueChange: (value: number | null) => void }
    | { valueMode: 'string'; value: string; onValueChange: (value: string) => void }
  );
export function NumberInput({ valueMode = 'number', value, onValueChange, ...props }: NumberInputProps) {
  return (
    <Input
      {...props}
      type="number"
      value={value ?? ''}
      onChange={event => {
        const raw = event.currentTarget.value;
        if (valueMode === 'string') (onValueChange as (value: string) => void)(raw);
        else
          (onValueChange as (value: number | null) => void)(
            raw.trim() === '' || !Number.isFinite(event.currentTarget.valueAsNumber)
              ? null
              : event.currentTarget.valueAsNumber,
          );
      }}
    />
  );
}
