import { useEffect, useId, useSyncExternalStore } from 'react';
import type { UpdateChecker } from '@niubu/hooks';
import { Button } from '@niubu/shadcn-ui/button';
import { CircleAlert, RefreshCw } from '@niubu/icons';

export type UpdateLabels = Readonly<{
  checking: string;
  available: string;
  unavailable: string;
  reload: string;
  dirty: string;
}>;
/** Main's onReload must re-read live interaction dirty before actually reloading. */
export function CheckUpdates({
  checker,
  dirty,
  onReload,
  labels,
}: {
  checker: UpdateChecker;
  dirty: boolean;
  onReload: () => void;
  labels: UpdateLabels;
}) {
  const snapshot = useSyncExternalStore(checker.subscribe, checker.getSnapshot, checker.getSnapshot);
  const dirtyId = useId();
  useEffect(() => {
    const visibility = () => checker.setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      checker.setVisible(false);
    };
  }, [checker]);
  if (snapshot.status === 'idle' || snapshot.status === 'current') return null;
  return (
    <div
      className="inline-flex min-h-8 min-w-0 max-w-full items-center gap-2 text-sm [@media(max-width:700px)]:w-8 [@media(max-width:700px)]:shrink-0 [@media(max-width:700px)]:justify-center"
      role="status"
      aria-live="polite"
    >
      {snapshot.status !== 'available' &&
        (snapshot.status === 'checking' ? (
          <RefreshCw aria-hidden="true" className="hidden size-4 [@media(max-width:700px)]:block" />
        ) : (
          <CircleAlert
            aria-hidden="true"
            className="hidden size-4 text-muted-foreground [@media(max-width:700px)]:block"
          />
        ))}
      <span className="[@media(max-width:700px)]:sr-only">
        {snapshot.status === 'available'
          ? labels.available
          : snapshot.status === 'checking'
            ? labels.checking
            : labels.unavailable}
      </span>
      {snapshot.status === 'available' && (
        <>
          {snapshot.errorCode && <span className="[@media(max-width:700px)]:sr-only">{labels.unavailable}</span>}
          <Button
            className="[@media(max-width:700px)]:size-8 [@media(max-width:700px)]:p-0"
            variant="outline"
            size="sm"
            type="button"
            disabled={dirty}
            aria-label={labels.reload}
            aria-describedby={dirty ? dirtyId : undefined}
            onClick={() => {
              if (!dirty) onReload();
            }}
          >
            <span aria-hidden="true" className="hidden [@media(max-width:700px)]:inline-flex">
              <RefreshCw className="size-4" />
            </span>
            <span className="[@media(max-width:700px)]:sr-only">{labels.reload}</span>
          </Button>
          {dirty && (
            <span className="[@media(max-width:700px)]:sr-only" id={dirtyId}>
              {labels.dirty}
            </span>
          )}
        </>
      )}
    </div>
  );
}
