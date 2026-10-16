import { createContext, useContext } from 'react';
export type InteractionState = {
  dirty: boolean;
  setDirty: (key: string, dirty: boolean) => void;
  readDraft: (scopeKey: string, draftKey: string) => unknown;
  writeDraft: (scopeKey: string, draftKey: string, value: unknown) => void;
  removeDraft: (scopeKey: string, draftKey: string) => void;
  runWithoutGuard: (action: () => void) => void;
  navigationAllowed: () => boolean;
};
export const InteractionContext = createContext<InteractionState | null>(null);
export function useInteractionState(): InteractionState {
  const state = useContext(InteractionContext);
  if (!state) throw new Error('可恢复表单需要 InteractionProvider');
  return state;
}
