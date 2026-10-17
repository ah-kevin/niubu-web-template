import { useEffect, useId, useSyncExternalStore } from 'react';
import type { UpdateChecker } from '@niubu/hooks';
import { Button } from '@niubu/shadcn-ui/button';

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
    <div role="status" aria-live="polite">
      <span>
        {snapshot.status === 'available'
          ? labels.available
          : snapshot.status === 'checking'
            ? labels.checking
            : labels.unavailable}
      </span>
      {snapshot.status === 'available' && (
        <>
          {snapshot.errorCode && <span>{labels.unavailable}</span>}
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={dirty}
            aria-describedby={dirty ? dirtyId : undefined}
            onClick={() => {
              if (!dirty) onReload();
            }}
          >
            {labels.reload}
          </Button>
          {dirty && <span id={dirtyId}>{labels.dirty}</span>}
        </>
      )}
    </div>
  );
}
