import { useId, useState } from 'react';
import type { ReactTable, RowData } from '@tanstack/react-table';
import { ArrowLeftToLine, ArrowRightToLine, ChevronDown, Settings2 } from '@niubu/icons';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Label } from '@niubu/shadcn-ui/label';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { Select } from '@niubu/shadcn-ui/select';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@niubu/shadcn-ui/popover';
import { cn } from '@niubu/shadcn-ui/cn';
import type { listFeatures, selectableListFeatures } from './profiles';
import type { TableLabels } from './types';
import { clampColumnWidth } from './preferences';
import { TableToolButton } from './TableToolButton';

export type ListNativeTable<T extends RowData> =
  ReactTable<typeof listFeatures, T> | ReactTable<typeof selectableListFeatures, T>;

function ColumnWidthInput({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <NumberInput
      className="w-20 min-w-0 justify-self-end"
      valueMode="string"
      value={draft}
      onValueChange={setDraft}
      aria-label={label}
      min={80}
      max={640}
      onBlur={() => {
        const next = Number(draft);
        const width = Number.isFinite(next) ? clampColumnWidth(next) : value;
        setDraft(String(width));
        onCommit(width);
      }}
    />
  );
}

export function ColumnSettings<T extends RowData>({
  table,
  labels,
  onResetColumns,
}: {
  table: ListNativeTable<T>;
  labels: TableLabels;
  onResetColumns?: () => void;
}) {
  const { t } = useTranslation();
  const [advanced, setAdvanced] = useState(false);
  const advancedId = useId();
  const columns = table.getAllLeafColumns();
  return (
    <Popover
      onOpenChange={open => {
        if (open) setAdvanced(false);
      }}
    >
      <PopoverTrigger asChild>
        <TableToolButton label={labels.settings} className="pattern-table-settings">
          <Settings2 aria-hidden="true" className="pattern-table-settings-chevron pattern-table-settings-icon" />
        </TableToolButton>
      </PopoverTrigger>
      <PopoverContent
        aria-label={labels.settings}
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'pattern-column-settings flex max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden p-0 text-[12px] leading-[1.5714285714]',
          advanced ? 'w-[360px]' : 'w-[240px]',
        )}
      >
        <div className="flex h-[2.4em] shrink-0 items-center border-b border-border px-3 font-semibold">
          {labels.settings}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {columns.map(column => {
            const name = labels.columnName(column.id);
            const visible = table.state.columnVisibility[column.id] !== false;
            const pin = column.getIsPinned();
            return (
              <div
                key={column.id}
                className="pattern-column-setting-row flex min-w-0 items-center gap-[6px] px-3 py-[.2em]"
              >
                <Label className="pattern-column-setting-toggle min-w-0 flex-1 gap-[6px] text-[12px] leading-[1.5714285714] font-normal">
                  <Checkbox
                    className="h-[15px] w-[1.22em] rounded-[2px] [&_svg]:size-[12px]"
                    checked={visible}
                    aria-label={labels.showColumn(name)}
                    disabled={!column.getCanHide() || (visible && table.getVisibleLeafColumns().length === 1)}
                    onCheckedChange={checked => column.toggleVisibility(checked === true)}
                  />
                  <span className="min-w-0 truncate" title={name}>
                    {name}
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-[18px] rounded-[2px] p-0 text-[12px] shadow-none aria-pressed:text-primary [&_svg]:size-[12px]"
                  title={`${labels.pinColumn(name)} ${labels.pinStart}`}
                  aria-label={`${labels.pinColumn(name)} ${labels.pinStart}`}
                  aria-pressed={pin === 'start'}
                  onClick={() => column.pin(pin === 'start' ? false : 'start')}
                >
                  <ArrowLeftToLine aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-[18px] rounded-[2px] p-0 text-[12px] shadow-none aria-pressed:text-primary [&_svg]:size-[12px]"
                  title={`${labels.pinColumn(name)} ${labels.pinEnd}`}
                  aria-label={`${labels.pinColumn(name)} ${labels.pinEnd}`}
                  aria-pressed={pin === 'end'}
                  onClick={() => column.pin(pin === 'end' ? false : 'end')}
                >
                  <ArrowRightToLine aria-hidden="true" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-between rounded-none px-3 py-[.4em] text-[12px]"
            aria-expanded={advanced}
            aria-controls={advancedId}
            onClick={() => setAdvanced(value => !value)}
          >
            {t('common:table.moreColumnSettings')}
            <ChevronDown aria-hidden="true" className={cn('size-[12px]', advanced && 'rotate-180')} />
          </Button>
          {advanced && (
            <div id={advancedId} className="border-t border-border px-3">
              {columns.map(column => {
                const name = labels.columnName(column.id);
                return (
                  <fieldset key={column.id} className="grid min-w-0 gap-2 border-b border-border py-2 last:border-0">
                    <legend className="pt-2 font-semibold">{name}</legend>
                    <Label className="pattern-column-setting-control grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)] items-center gap-2 text-[12px] font-normal">
                      {labels.columnWidth(name)}
                      <ColumnWidthInput
                        key={`${column.id}:${column.getSize()}`}
                        value={column.getSize()}
                        label={labels.columnWidth(name)}
                        onCommit={value => table.setColumnSizing(old => ({ ...old, [column.id]: value }))}
                      />
                    </Label>
                    <Label className="pattern-column-setting-control grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)] items-center gap-2 text-[12px] font-normal">
                      {labels.pinColumn(name)}
                      <Select
                        className="w-full min-w-0"
                        label={labels.pinColumn(name)}
                        value={column.getIsPinned() || 'none'}
                        onValueChange={value =>
                          column.pin(value === 'start' ? 'start' : value === 'end' ? 'end' : false)
                        }
                        options={[
                          { value: 'none', label: labels.unpin },
                          { value: 'start', label: labels.pinStart },
                          { value: 'end', label: labels.pinEnd },
                        ]}
                      />
                    </Label>
                  </fieldset>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-[6px] border-t border-border px-3 py-[.4em]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-[2em] px-[6px] text-[12px] shadow-none"
            onClick={() => {
              if (onResetColumns) onResetColumns();
              else {
                table.resetColumnVisibility();
                table.resetColumnSizing();
                table.resetColumnPinning();
              }
            }}
          >
            {labels.resetColumns}
          </Button>
          <PopoverClose asChild>
            <Button type="button" variant="outline" size="sm" className="h-[2em] px-[6px] text-[12px] shadow-none">
              {t('common:close')}
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
