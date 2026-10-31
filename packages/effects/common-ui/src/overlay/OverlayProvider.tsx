import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@niubu/shadcn-ui/alert-dialog';
import { CircleAlert } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { PendingOverlay } from '@niubu/shadcn-ui/pending-overlay';
import { OverlayContext, useOverlayLabels } from './OverlayContext';
import type { OverlayApi, OverlayOptions } from './types';
import { captureOverlayFocus, restoreOverlayFocus } from './focus-restoration';

type Entry = {
  id: number;
  kind: 'confirm' | 'alert';
  options: OverlayOptions;
  settle: (confirmed: boolean) => void;
};

export function OverlayProvider({ children }: { children: ReactNode }) {
  const labels = useOverlayLabels();
  const entries = useRef<Entry[]>([]);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const lifecycle = useRef(0);
  const initialFocus = useRef<HTMLButtonElement | null>(null);
  const surface = useRef<HTMLDivElement | null>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState<Entry | null>(null);
  const api = useMemo<OverlayApi>(() => {
    function enqueue(kind: Entry['kind'], options: OverlayOptions): Promise<boolean> {
      if (!mounted.current || options.signal?.aborted) return Promise.resolve(false);
      if (entries.current.length === 0 && !surface.current?.contains(document.activeElement)) {
        returnTarget.current = captureOverlayFocus();
      }
      return new Promise(resolve => {
        let settled = false;
        const entry: Entry = {
          id: ++sequence.current,
          kind,
          options,
          settle(confirmed) {
            if (settled) return;
            settled = true;
            options.signal?.removeEventListener('abort', abort);
            entries.current = entries.current.filter(item => item.id !== entry.id);
            if (mounted.current) setActive(entries.current[0] ?? null);
            resolve(confirmed);
          },
        };
        const abort = () => entry.settle(false);
        entries.current.push(entry);
        options.signal?.addEventListener('abort', abort, { once: true });
        setActive(entries.current[0] ?? null);
      });
    }
    return {
      confirm: options => enqueue('confirm', options),
      alert: options => enqueue('alert', options).then(() => {}),
    };
  }, []);

  const disposeIfCurrent = useCallback((generation: number) => {
    if (lifecycle.current !== generation) return;
    mounted.current = false;
    for (const entry of [...entries.current]) entry.settle(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const generation = ++lifecycle.current;
    return () => {
      // StrictMode immediately sets up this same owner again. A real unmount
      // retains this generation at the microtask boundary. Child replay effects
      // may enqueue before our setup, so cleanup cannot dispose synchronously.
      queueMicrotask(() => disposeIfCurrent(generation));
    };
  }, [disposeIfCurrent]);

  useLayoutEffect(() => {
    if (active) initialFocus.current?.focus({ preventScroll: true });
  }, [active]);

  function finish(entry: Entry, confirmed: boolean) {
    if (entries.current[0]?.id === entry.id) entry.settle(confirmed);
  }
  return (
    <OverlayContext.Provider value={api}>
      {children}
      {active && (
        <Suspense fallback={<PendingOverlay onCancel={() => finish(active, false)} />}>
          <AlertDialog
            open
            onOpenChange={open => {
              if (!open) finish(active, false);
            }}
          >
            <AlertDialogContent
              ref={surface}
              tone={active.options.tone}
              onOpenAutoFocus={event => {
                event.preventDefault();
                initialFocus.current?.focus({ preventScroll: true });
              }}
              onEscapeKeyDown={event => {
                event.preventDefault();
                finish(active, false);
              }}
              onCloseAutoFocus={event => {
                event.preventDefault();
                if (entries.current.length === 0) restoreOverlayFocus(returnTarget.current, event.target);
              }}
            >
              <AlertDialogHeader key={`header-${active.id}`}>
                <AlertDialogTitle className="flex items-center gap-3">
                  {active.options.tone && active.options.tone !== 'default' && (
                    <CircleAlert
                      aria-hidden="true"
                      className={
                        active.options.tone === 'danger'
                          ? 'size-6 shrink-0 text-destructive-text'
                          : 'size-6 shrink-0 text-warning'
                      }
                    />
                  )}
                  {active.options.title}
                </AlertDialogTitle>
                <AlertDialogDescription className={active.options.description == null ? 'sr-only' : undefined}>
                  {active.options.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter key={`footer-${active.id}`}>
                {active.kind === 'confirm' && (
                  <Button ref={initialFocus} type="button" variant="outline" onClick={() => finish(active, false)}>
                    {labels.cancel}
                  </Button>
                )}
                <Button
                  ref={active.kind === 'alert' ? initialFocus : undefined}
                  variant={active.options.tone === 'danger' ? 'destructive' : 'default'}
                  type="button"
                  onClick={() => finish(active, true)}
                >
                  {labels.confirm}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Suspense>
      )}
    </OverlayContext.Provider>
  );
}
