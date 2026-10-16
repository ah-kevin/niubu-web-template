import { createContext, useContext } from 'react';
export type PreviewServiceState = { readonly mode: 'disabled' | 'enabled' };
/** Standalone previews default to disabled. The application supplies its concrete owner state. */
export const PreviewServiceProvider = createContext<PreviewServiceState['mode']>('disabled');
export function usePreviewServiceMode() {
  return useContext(PreviewServiceProvider);
}
