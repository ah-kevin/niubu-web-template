import { lazy, Suspense, useId, useMemo, useRef } from 'react';
import { PendingOverlay } from '@niubu/layout-ui';
import { useTranslation } from '@niubu/locales/react';
import { useOptionalPreferenceManager } from '@niubu/preferences';
import { Bell } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { useOverlaySession } from '../hooks/useOverlaySession';
import type { NotificationOptions } from './types';
const NotificationSheet = lazy(() => import('./NotificationSheet'));
export type NotificationsProps = NotificationOptions & { sessionKey: unknown };
export function Notifications({ sessionKey, renderSheet, ...notifications }: NotificationsProps) {
  const { t } = useTranslation();
  const manager = useOptionalPreferenceManager();
  const lifecycleKey = useMemo(() => ({ sessionKey, manager }), [sessionKey, manager]);
  const trigger = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const overlay = useOverlaySession(lifecycleKey, () => trigger.current);
  const props = { ...notifications, contentId, onClose: () => overlay.close(), returnFocus: overlay.returnFocus };
  return (
    <>
      <Button
        ref={trigger}
        data-slot="sheet-trigger"
        data-state={overlay.open ? 'open' : 'closed'}
        aria-controls={contentId}
        variant="ghost"
        size="icon"
        aria-haspopup="dialog"
        aria-expanded={overlay.open}
        aria-label={t('shell:notifications')}
        title={t('shell:notifications')}
        onClick={() => overlay.openOverlay(trigger.current)}
      >
        <Bell aria-hidden="true" />
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
          {renderSheet ? renderSheet(props) : <NotificationSheet {...props} />}
        </Suspense>
      )}
    </>
  );
}
