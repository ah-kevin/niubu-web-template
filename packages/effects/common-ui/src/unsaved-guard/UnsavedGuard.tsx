import { useTranslation } from '@niubu/locales/react';
import { useRef, type ReactNode } from 'react';
import { captureOverlayFocus, restoreOverlayFocus } from '../overlay/focus-restoration';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@niubu/shadcn-ui/alert-dialog';

type UnsavedGuardProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  onDiscard?: () => void;
  preserveDraft?: boolean;
  description?: ReactNode;
};

export function UnsavedGuard({
  open,
  onStay,
  onLeave,
  preserveDraft = true,
  description,
  onDiscard,
}: UnsavedGuardProps) {
  const { t } = useTranslation();
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onOpenAutoFocus={() => {
          previousFocus.current = captureOverlayFocus();
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          restoreOverlayFocus(previousFocus.current, event.target);
        }}
        onEscapeKeyDown={event => {
          event.preventDefault();
          onStay();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t('common:guard.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              (preserveDraft ? t('common:guard.preserveDescription') : t('common:guard.discardDescription'))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>{t('common:guard.edit')}</AlertDialogCancel>
          {onDiscard && <AlertDialogAction onClick={onDiscard}>{t('common:guard.discard')}</AlertDialogAction>}
          <AlertDialogAction onClick={onLeave}>
            {preserveDraft ? t('common:guard.preserve') : t('common:guard.discard')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
