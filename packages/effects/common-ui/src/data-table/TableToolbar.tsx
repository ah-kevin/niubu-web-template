import { Maximize, Minimize, RefreshCw, Search } from '@niubu/icons';
import { useTranslation } from '@niubu/locales/react';
import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { RowData } from '@tanstack/react-table';
import { cn } from '@niubu/shadcn-ui/cn';
import type { BaseTableProps, ListSlices } from './types';
import { ColumnSettings, type PresentationTable } from './ColumnSettings';
import { TableToolButton } from './TableToolButton';

export function TableToolbar<T extends RowData>({
  table,
  props,
  selectionSummary,
  maximized,
  onMaximizeChange,
}: {
  table: PresentationTable<T>;
  props: BaseTableProps<T> & ListSlices;
  selectionSummary?: ReactNode;
  maximized: boolean;
  onMaximizeChange: (maximized: boolean) => void;
}) {
  const { t } = useTranslation();
  const maximizeButton = useRef<HTMLButtonElement | null>(null);
  const restoreMaximizeFocus = useRef(false);
  const bindMaximizeButton = useCallback((button: HTMLButtonElement | null) => {
    if (!button && maximizeButton.current) {
      const previous = maximizeButton.current;
      restoreMaximizeFocus.current = previous.ownerDocument.activeElement === previous;
    }
    maximizeButton.current = button;
  }, []);
  useLayoutEffect(() => {
    if (!restoreMaximizeFocus.current) return;
    restoreMaximizeFocus.current = false;
    const button = maximizeButton.current;
    if (!button?.isConnected) return;
    const document = button.ownerDocument;
    // Only replace focus lost with this remounted control; never take it from another live control.
    if (document.activeElement === document.body || document.activeElement === document.documentElement)
      button.focus({ preventScroll: true });
  }, [maximized]);
  const toolbar = props.toolbar;
  const title = toolbar?.title === undefined ? props.caption : toolbar.title;
  const pending = props.readState === 'pending';
  const node = (
    <div
      role="toolbar"
      aria-label={props.caption}
      className="pattern-table-toolbar mx-[8px] flex min-h-[46.4px] flex-wrap items-center justify-between gap-[6px] p-0 text-[12px]"
    >
      <div className="pattern-table-summary flex min-w-0 flex-auto flex-wrap items-center gap-x-3 gap-y-[6px] [&>p]:m-0">
        {title != null && <h2 className="min-w-0 text-[16px] leading-6 font-semibold">{title}</h2>}
        {selectionSummary}
      </div>
      <div className="pattern-table-tools ms-auto flex min-w-0 flex-wrap items-center justify-end gap-[6px]">
        {toolbar?.actions}
        {toolbar?.search && (
          <TableToolButton
            label={t('common:table.search')}
            aria-pressed={toolbar.search.visible}
            onClick={() => toolbar.search?.onVisibleChange(!toolbar.search.visible)}
          >
            <Search aria-hidden="true" />
          </TableToolButton>
        )}
        {toolbar?.onRefresh && (
          <TableToolButton
            label={t('common:table.refresh')}
            aria-busy={pending}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) toolbar.onRefresh?.();
            }}
          >
            <RefreshCw aria-hidden="true" className={cn(pending && 'animate-spin')} />
          </TableToolButton>
        )}
        {toolbar?.allowMaximize && (
          <TableToolButton
            ref={bindMaximizeButton}
            label={t(maximized ? 'common:exitFullscreen' : 'common:fullscreen')}
            aria-pressed={maximized}
            onClick={() => onMaximizeChange(!maximized)}
          >
            {maximized ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          </TableToolButton>
        )}
        <ColumnSettings table={table} labels={props.labels} onResetColumns={props.onResetColumns} />
      </div>
    </div>
  );
  return !maximized && toolbar?.render ? toolbar.render(node) : node;
}
