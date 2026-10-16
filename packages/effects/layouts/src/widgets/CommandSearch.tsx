import { lazy, Suspense, useId, useMemo, useRef } from 'react';
import { PendingOverlay } from '@niubu/layout-ui';
import { useOptionalPreferenceManager } from '@niubu/preferences';
import { useTranslation } from '@niubu/locales/react';
import { Search } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { shortcutHint } from '@niubu/hooks';
import { useOverlaySession } from '../hooks/useOverlaySession';
import { useShellShortcuts } from '../hooks/useShellShortcuts';
import type { SearchOptions } from './types';
const CommandSearchDialog = lazy(() => import('./CommandSearchDialog'));
export type CommandSearchProps = SearchOptions & { sessionKey: unknown };
export function CommandSearch({ sessionKey, renderDialog, ...search }: CommandSearchProps) {
  const { t } = useTranslation();
  const manager = useOptionalPreferenceManager();
  const lifecycleKey = useMemo(() => ({ sessionKey, manager }), [sessionKey, manager]);
  const trigger = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const overlay = useOverlaySession(lifecycleKey, () => trigger.current);
  const close = () => overlay.close();
  useShellShortcuts({
    search: () => {
      if (overlay.open) {
        overlay.close();
        overlay.returnFocus();
      } else overlay.openOverlay(trigger.current);
    },
  });
  const props = { ...search, contentId, onClose: close, returnFocus: overlay.returnFocus };
  return (
    <>
      <Button
        ref={trigger}
        data-slot="dialog-trigger"
        data-state={overlay.open ? 'open' : 'closed'}
        aria-controls={contentId}
        className="search-trigger"
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={overlay.open}
        aria-label={t('shell:search.trigger')}
        onClick={() => overlay.openOverlay(trigger.current)}
      >
        <Search size={16} aria-hidden="true" />
        <span>{t('shell:search.title')}</span>
        <kbd>{shortcutHint(navigator.platform, 'K')}</kbd>
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
          {renderDialog ? renderDialog(props) : <CommandSearchDialog {...props} />}
        </Suspense>
      )}
    </>
  );
}
