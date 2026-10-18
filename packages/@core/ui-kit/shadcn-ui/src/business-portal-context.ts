import { createContext, useContext, type Ref } from 'react';

export type PortalScope = { container: HTMLElement | null; locked: boolean; kind: 'business' | 'lock' | 'reauth' };
export const PortalContext = createContext<PortalScope | null>(null);
type ContentCommit = { commit(): () => void; ref?: Ref<HTMLElement> };
export const ContentCommitContext = createContext<ContentCommit | null>(null);
export function useBusinessPortalScope() { return useContext(PortalContext); }
/** Internal: a business caller cannot override its stable host with an explicit container. */
export function useBusinessPortalContainer(explicit?: Element | DocumentFragment | null) {
  const scope = useBusinessPortalScope();
  return { ready: scope === null || scope.container !== null, container: scope ? scope.container : explicit };
}
export function usePortalInteractionKind() { return useBusinessPortalScope()?.kind ?? 'business'; }
