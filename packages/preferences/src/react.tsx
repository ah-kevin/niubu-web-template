import type { ReactNode } from 'react';
import { PreferenceContext } from './react-context.ts';
import type { PreferenceManager } from './manager.ts';
/** Instances and their lifetime belong to the caller; this component only binds context. */
export function PreferenceProvider({ manager, children }: { manager: PreferenceManager; children: ReactNode }) {
  return <PreferenceContext value={manager}>{children}</PreferenceContext>;
}
