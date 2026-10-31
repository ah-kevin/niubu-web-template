import { Input } from '@niubu/shadcn-ui/input';
import { Button } from '@niubu/shadcn-ui/button';
import { Select } from '@niubu/shadcn-ui/select';
import type { ColumnFilterField } from './advanced-types';

export function ColumnFilterControl({
  field,
  value,
  onChange,
  activeLabel,
  clearLabel,
  disabled,
}: {
  field: ColumnFilterField;
  value: string;
  onChange: (value: string) => void;
  activeLabel: string;
  clearLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="pattern-column-filter mt-1 flex min-w-0 items-center gap-1" data-filtered={!!value || undefined}>
      {field.options ? (
        <Select
          label={field.label}
          value={value || '__all__'}
          disabled={disabled}
          options={[{ value: '__all__', label: clearLabel }, ...field.options]}
          onValueChange={next => onChange(next === '__all__' ? '' : next)}
        />
      ) : (
        <Input
          aria-label={field.label}
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
        />
      )}
      {value && (
        <>
          <span className="sr-only">{activeLabel}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`${clearLabel}: ${field.label}`}
            disabled={disabled}
            onClick={() => onChange('')}
          >
            ×
          </Button>
        </>
      )}
    </div>
  );
}
