import { useOptionalPreferenceManager } from '@niubu/preferences';
import { PendingOverlay } from '@niubu/layout-ui';
import { Suspense, useId, useRef, useMemo } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { SlidersHorizontal } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { useOverlaySession } from '../hooks/useOverlaySession';
import { useShellShortcuts } from '../hooks/useShellShortcuts';
import type { OverlayRenderer } from './types';
export type DisplaySettingsProps = { sessionKey?: unknown; renderPreferences: OverlayRenderer };
export function DisplaySettings({ sessionKey = '', renderPreferences }: DisplaySettingsProps) {
  const { t } = useTranslation();
  const trigger = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const manager = useOptionalPreferenceManager();
  const lifecycleKey = useMemo(() => ({ sessionKey, manager }), [sessionKey, manager]);
  const overlay = useOverlaySession(lifecycleKey, () => trigger.current);
  useShellShortcuts({ preferences: () => (overlay.open ? overlay.close() : overlay.openOverlay(trigger.current)) });
  return (
    <>
      <Button
        ref={trigger}
        data-slot="dialog-trigger"
        data-state={overlay.open ? 'open' : 'closed'}
        aria-controls={contentId}
        variant="ghost"
        size="icon"
        aria-haspopup="dialog"
        aria-expanded={overlay.open}
        aria-label={t('shell:displayPreferences')}
        title={t('shell:displayPreferences')}
        onClick={() => overlay.openOverlay(trigger.current)}
      >
        <SlidersHorizontal aria-hidden="true" />
      </Button>
      {overlay.open && (
        <Suspense
          fallback={
            <PendingOverlay
              onCancel={() => {
                overlay.close();
                overlay.returnFocus();
              }}
            />
          }
        >
          {renderPreferences({ contentId, onClose: () => overlay.close(), returnFocus: overlay.returnFocus })}
        </Suspense>
      )}
    </>
  );
}
