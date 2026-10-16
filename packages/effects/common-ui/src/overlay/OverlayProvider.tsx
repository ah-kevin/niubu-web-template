import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@niubu/shadcn-ui/alert-dialog';
import { Button } from '@niubu/shadcn-ui/button';
import { PendingOverlay } from '@niubu/shadcn-ui/pending-overlay';
import { OverlayContext, useOverlayLabels } from './OverlayContext';
import type { OverlayApi, OverlayOptions } from './types';

type Entry = {
  id: number;
  kind: 'confirm' | 'alert';
  options: OverlayOptions;
  trigger: HTMLElement | null;
  settle: (confirmed: boolean) => void;
};

export function OverlayProvider({ children }: { children: ReactNode }) {
  const labels = useOverlayLabels();
  const entries = useRef<Entry[]>([]);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const lifecycle = useRef(0);
  const initialFocus = useRef<HTMLButtonElement | null>(null);
  const [active, setActive] = useState<Entry | null>(null);
  const api = useMemo<OverlayApi>(() => {
    function enqueue(kind: Entry['kind'], options: OverlayOptions): Promise<boolean> {
      if (!mounted.current || options.signal?.aborted) return Promise.resolve(false);
      return new Promise(resolve => {
        let settled = false;
        const entry: Entry = {
          id: ++sequence.current,
          kind,
          options,
          trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null,
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

  function finish(entry: Entry, confirmed: boolean) {
    if (entries.current[0]?.id === entry.id) entry.settle(confirmed);
  }
  return (
    <OverlayContext.Provider value={api}>
      {children}
      {active && (
        <Suspense key={active.id} fallback={<PendingOverlay onCancel={() => finish(active, false)} />}>
          <AlertDialog
            open
            onOpenChange={open => {
              if (!open) finish(active, false);
            }}
          >
            <AlertDialogContent
              onOpenAutoFocus={event => {
                event.preventDefault();
                initialFocus.current?.focus();
              }}
              onEscapeKeyDown={event => {
                event.preventDefault();
                finish(active, false);
              }}
              onCloseAutoFocus={event => {
                event.preventDefault();
                if (entries.current.length === 0 && active.trigger?.isConnected) active.trigger.focus();
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>{active.options.title}</AlertDialogTitle>
                <AlertDialogDescription className={active.options.description == null ? 'sr-only' : undefined}>
                  {active.options.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                {active.kind === 'confirm' && (
                  <Button ref={initialFocus} type="button" variant="outline" onClick={() => finish(active, false)}>
                    {labels.cancel}
                  </Button>
                )}
                <Button
                  ref={active.kind === 'alert' ? initialFocus : undefined}
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
