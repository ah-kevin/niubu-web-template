import type { RowSelectionState } from '@tanstack/react-table';
import type { SliceOwner } from './types';

export interface TreeOptions<T> {
  selection?: {
    /** Successful child loads publish newly inherited selected IDs to this owner. */
    state: SliceOwner<RowSelectionState>;
    /** Disabled nodes are cascade barriers; their subtree is left unchanged. */
    isDisabled?: (row: T) => boolean;
    labels: { selectAll: string; selectRow: (row: T) => string };
  };
  lazy?: {
    /** Identity/scope/generation boundary. Changing it cancels and discards all loads. */
    ownerKey: string;
    hasChildren: (row: T) => boolean;
    /** Return validated children. The table also checks IDs and cycles before accepting them. */
    loadChildren: (row: T, context: { signal: AbortSignal }) => Promise<readonly T[]>;
    labels: { loading: string; error: string; retry: string; empty: string };
  };
  /** Searches loaded node labels only. Does not fetch unloaded descendants. */
  search?: { query: string };
}
