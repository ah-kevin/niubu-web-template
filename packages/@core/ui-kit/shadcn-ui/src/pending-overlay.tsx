import { useEffect, useEffectEvent } from 'react';
import { registerPendingOverlay } from './overlay-ownership';
/** Local cancellation remains available even when global shortcuts are disabled. */
export function PendingOverlay({ onCancel }: { onCancel: () => void }) {
  const cancel = useEffectEvent(onCancel);
  useEffect(() => registerPendingOverlay(window, () => cancel()), []);
  return null;
}
