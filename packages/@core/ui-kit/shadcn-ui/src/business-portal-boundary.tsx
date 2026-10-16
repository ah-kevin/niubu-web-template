import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type ReactElement, type Ref, cloneElement } from 'react';

type PortalScope = { container: HTMLElement | null; locked: boolean; kind: 'business' | 'lock' | 'reauth' };
const PortalContext = createContext<PortalScope | null>(null);
type ContentCommit = { commit(): () => void; ref?: Ref<HTMLElement> };
const ContentCommitContext = createContext<ContentCommit | null>(null);

/** One business root and one host for the entire mounted shell lifetime. */
export function BusinessPortalBoundary({ locked, children }: { locked: boolean; children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const hostRef = useCallback((node: HTMLDivElement | null) => { setContainer(node); }, []);
  const scope = useMemo<PortalScope>(() => ({ container, locked, kind: 'business' }), [container, locked]);
  return <PortalContext.Provider value={scope}><div data-business-root="" inert={locked || undefined} style={{ display: 'contents' }}>{children}<div data-business-portal-host="" ref={hostRef} /></div></PortalContext.Provider>;
}

/** Internal: a business caller cannot override its stable host with an explicit container. */
export function useBusinessPortalContainer(explicit?: Element | DocumentFragment | null) {
  const scope = useContext(PortalContext);
  return { ready: scope === null || scope.container !== null, container: scope ? scope.container : explicit };
}
export function usePortalInteractionKind() {
  return useContext(PortalContext)?.kind ?? 'business';
}

/** Inside the real Portal, immediately outside the actual Content/Overlay primitives.
 * The latch is written only after this content tree commits, never for a Portal or lazy fallback.
 * Its DOM ref also preserves Radix Presence's existing ref/animation lifetime.
 */
export function BusinessPortalAdmission({ children, ref }: { children: ReactNode; ref?: Ref<HTMLElement> }) {
  const scope = useContext(PortalContext);
  const [committed, setCommitted] = useState(false);
  const blocked = scope?.kind === 'business' && scope.locked && !committed;
  const commit = useCallback(() => {
    setCommitted(true);
    return () => { setCommitted(false); };
  }, []);
  const content = useMemo(() => ({ commit, ref }), [commit, ref]);
  if (blocked) return null;
  return <ContentCommitContext.Provider value={content}>{children}</ContentCommitContext.Provider>;
}


function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') return ref(node);
  if (ref) ref.current = node;
}

/** Only the actual primitive's DOM ref can admit a presence; a closed Content or fallback cannot. */
export function BusinessPortalContent({ children }: { children: ReactElement<{ ref?: Ref<HTMLElement> }> }) {
  const admission = useContext(ContentCommitContext);
  const original = children.props.ref;
  const ref = useCallback((node: HTMLElement | null) => {
    const undo = node ? admission?.commit() : undefined;
    const cleanup = assignRef(original, node);
    const portalCleanup = assignRef(admission?.ref, node);
    return () => {
      undo?.();
      if (typeof cleanup === 'function') cleanup();
      else assignRef(original, null);
      if (typeof portalCleanup === 'function') portalCleanup();
      else assignRef(admission?.ref, null);
    };
  }, [admission, original]);
  return cloneElement(children, { ref });
}

/** Internal trusted scope: fixed node identity, attached only while active. An empty dormant
 * host must not be captured by an earlier business modal's hideOthers effect.
 */
export function LocalLockPortalHost({ kind, active, children }: { kind: 'lock' | 'reauth'; active: boolean; children: ReactNode }) {
  const stable = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const node = stable.current ?? document.createElement('div');
    stable.current = node;
    node.dataset.localLockHost = kind;
    document.body.append(node);
    setContainer(node);
    return () => { node.remove(); setContainer(null); };
  }, [active, kind]);
  const scope = useMemo<PortalScope>(() => ({ container, locked: false, kind }), [container, kind]);
  return <PortalContext.Provider value={scope}>{active && container ? children : null}</PortalContext.Provider>;
}
