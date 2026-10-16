import { useTranslation } from '@niubu/locales/react';
import { useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Info } from '@niubu/icons';
import { Button } from '@niubu/shadcn-ui/button';
import { usePreviewServiceMode } from '../preview-service';
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

export type ActionPreviewProps = {
  valid: boolean;
  children: ReactNode;
  reason?: string;
  label?: string;
  title?: string;
  /** Review acknowledgement only. This is never a service submission callback. */
  onReview?: () => void;
};

export function ActionPreview({ valid, children, reason, label, title, onReview }: ActionPreviewProps): ReactElement {
  const { t } = useTranslation();
  const service = usePreviewServiceMode();
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const reasonId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="pattern-action-preview">
      <Button
        ref={trigger}
        type="button"
        disabled={!valid}
        aria-describedby={!valid ? reasonId : undefined}
        onClick={() => setOpen(true)}
      >
        {label ?? t('common:checkContinue')}
      </Button>
      {!valid && (
        <p id={reasonId} className="pattern-action-reason">
          {reason ?? t('common:action.reason')}
        </p>
      )}
      {valid && reviewed && (
        <div className="submission-state" role="status">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>{t(service === 'disabled' ? 'common:notSubmitted' : 'common:previewNotSubmitted')}</strong>
            <p>{t('common:action.noRecords')}</p>
          </div>
        </div>
      )}
      <AlertDialog open={open && valid} onOpenChange={setOpen}>
        <AlertDialogContent
          className="pattern-action-dialog"
          onCloseAutoFocus={event => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="pattern-title">{title ?? t('common:action.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('common:action.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="pattern-review-content">{children}</div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:backToEdit')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReviewed(true);
                onReview?.();
              }}
            >
              {t('common:confirmPreview')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
