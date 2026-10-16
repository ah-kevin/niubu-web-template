export type FullscreenDocument = EventTarget & {
  readonly fullscreenEnabled?: boolean;
  readonly fullscreenElement: Element | null;
  readonly documentElement: { requestFullscreen?: () => Promise<void> };
  exitFullscreen?: () => Promise<void>;
};
export type FullscreenSnapshot = Readonly<{
  status: 'unsupported' | 'idle' | 'pending' | 'error';
  active: boolean;
  error?: string;
}>;
/** Read real Fullscreen API state. A request resolving without a state change is a failure. */
export function createFullscreenController({ document: doc }: { document: FullscreenDocument }) {
  const supported = Boolean(doc.fullscreenEnabled && doc.documentElement.requestFullscreen && doc.exitFullscreen);
  let disposed = false,
    pending = false;
  let snapshot: FullscreenSnapshot = Object.freeze({
    status: supported ? 'idle' : 'unsupported',
    active: Boolean(doc.fullscreenElement),
  });
  const listeners = new Set<() => void>();
  const publish = (status: FullscreenSnapshot['status'], error?: string) => {
    if (disposed) return;
    snapshot = Object.freeze({ status, active: Boolean(doc.fullscreenElement), ...(error ? { error } : {}) });
    listeners.forEach(listener => listener());
  };
  const change = () => publish(supported ? 'idle' : 'unsupported');
  const error = () => publish('error', 'Fullscreen request failed');
  doc.addEventListener('fullscreenchange', change);
  doc.addEventListener('fullscreenerror', error);
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (!disposed) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async toggle() {
      if (disposed || pending || !supported) return;
      const leaving = Boolean(doc.fullscreenElement);
      pending = true;
      publish('pending');
      try {
        if (leaving) await doc.exitFullscreen!();
        else await doc.documentElement.requestFullscreen!();
        if (!disposed) {
          const changed = leaving ? !doc.fullscreenElement : doc.fullscreenElement === doc.documentElement;
          if (changed && snapshot.status !== 'error') publish('idle');
          else if (snapshot.status !== 'error') publish('error', 'Fullscreen state did not change');
        }
      } catch {
        publish('error', 'Fullscreen request was denied or failed');
      } finally {
        pending = false;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      doc.removeEventListener('fullscreenchange', change);
      doc.removeEventListener('fullscreenerror', error);
      listeners.clear();
    },
  };
}
