import type { MouseEvent, KeyboardEvent } from 'react';
export function rowActivation<T>(row: T, onRowActivate: ((row: T) => void) | undefined) {
  return {
    tabIndex: onRowActivate ? 0 : undefined,
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (!(
        event.target instanceof Element &&
        event.target.closest(
          'label,button,a,input,select,textarea,[role="button"],[data-row-action],[contenteditable="true"]',
        )
      ))
        onRowActivate?.(row);
    },
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.target === event.currentTarget && event.key === 'Enter') {
        event.preventDefault();
        onRowActivate?.(row);
      }
    },
  };
}
