import { useState } from 'react';
import { usePreferenceManager, usePreferenceSnapshot, type PersistenceResult } from '@niubu/preferences';
import type { DisplayPreferences } from './DisplayPreferenceControls';

/** Operation feedback belongs to this control and manager, not unrelated extension writes. */
export function useManagedDisplayPreferences() {
  const manager = usePreferenceManager();
  const { core } = usePreferenceSnapshot();
  const [feedback, setFeedback] = useState<{ owner: typeof manager; persistence: PersistenceResult | null }>({
    owner: manager,
    persistence: null,
  });
  if (feedback.owner !== manager) setFeedback({ owner: manager, persistence: null });
  return {
    preferences: { theme: core.theme.mode, density: core.density } as DisplayPreferences,
    persistence: feedback.owner === manager ? feedback.persistence : null,
    update: (next: DisplayPreferences) => {
      const persistence = manager.update({ theme: { mode: next.theme }, density: next.density });
      setFeedback({ owner: manager, persistence });
      return persistence;
    },
  };
}
