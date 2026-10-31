import { useState } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { Input } from '@niubu/shadcn-ui/input';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@niubu/shadcn-ui/popover';
import type { ColumnFilterField, ColumnFilterValue } from './advanced-types';
import { filterValues, hasFilterValue } from './advanced-state';

export function ColumnFilterControl({
  field,
  value,
  onChange,
  activeLabel,
  clearLabel,
  applyLabel,
  multiple = false,
  disabled,
}: {
  field: ColumnFilterField;
  value: ColumnFilterValue;
  onChange: (value: ColumnFilterValue) => void;
  activeLabel: string;
  clearLabel: string;
  applyLabel?: string;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const active = hasFilterValue(value);
  return (
    <Popover
      open={open && !disabled}
      onOpenChange={next => {
        setOpen(next);
        if (next) setDraft(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="pattern-column-filter size-[20px] shrink-0 p-0"
          aria-label={field.label}
          data-filtered={active || undefined}
          title={active ? `${field.label}: ${activeLabel}` : field.label}
          disabled={disabled}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-[12px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 5h18l-7 8v6l-4 2v-8z" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={field.label} align="start" className="w-[220px] p-3">
        <div className="grid max-h-64 gap-2 overflow-y-auto">
          {field.options ? (
            field.options.map(option => (
              <label key={option.value} className="flex items-center gap-2">
                <Checkbox
                  checked={filterValues(draft).includes(option.value)}
                  onCheckedChange={checked => {
                    if (multiple)
                      setDraft(
                        checked
                          ? [...filterValues(draft), option.value]
                          : filterValues(draft).filter(value => value !== option.value),
                      );
                    else setDraft(checked ? option.value : '');
                  }}
                />
                {option.label}
              </label>
            ))
          ) : (
            <Input
              aria-label={field.label}
              value={typeof draft === 'string' ? draft : ''}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  onChange(draft);
                  setOpen(false);
                }
              }}
            />
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const empty = multiple && field.options ? [] : '';
              setDraft(empty);
              onChange(empty);
            }}
          >
            {clearLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            {applyLabel ?? t('common:confirm')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
