import { useTranslation } from '@niubu/locales/react';
import { useContext, useId, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { ArrowUpRight } from '@niubu/icons';
import { InteractionContext } from '@niubu/stores';
import { useReturnPathResolver } from '../return-path';
import { Button } from '@niubu/shadcn-ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@niubu/shadcn-ui/sheet';
import { UnsavedGuard } from '../unsaved-guard';

export type QuickViewProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detailHref: string;
  children: ReactNode;
  title?: string;
  description?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Required for dirty full-detail navigation; must keep this provider session mounted. */
  onNavigate?: (href: string) => void;
  /** Use with a FormFrame for session-only draft preservation. */
  dirty?: boolean;
};

export function QuickView({
  open,
  onOpenChange,
  detailHref,
  children,
  title,
  description,
  returnFocusRef,
  onNavigate,
  dirty = false,
}: QuickViewProps): ReactElement {
  const { t } = useTranslation();
  const safeReturnTo = useReturnPathResolver();
  const interaction = useContext(InteractionContext);
  const [confirmClose, setConfirmClose] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const unavailableReasonId = useId();
  const cannotPreserveDestination = dirty && !onNavigate;
  if (pendingHref && !onNavigate) {
    setPendingHref(null);
    setConfirmClose(false);
  }
  const previousFocus = useRef<HTMLElement | null>(null);
  const href = safeReturnTo(detailHref, '');
  function leave() {
    setConfirmClose(false);
    const action = () => {
      onOpenChange(false);
      if (pendingHref) onNavigate?.(pendingHref);
    };
    if (interaction) interaction.runWithoutGuard(action);
    else action();
    setPendingHref(null);
  }
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={next => {
          if (!next && dirty) {
            setPendingHref(null);
            setConfirmClose(true);
          } else onOpenChange(next);
        }}
      >
        <SheetContent
          closeLabel={t('common:close')}
          className="pattern-quick-view"
          onOpenAutoFocus={() => {
            previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={event => {
            const target = returnFocusRef?.current ?? previousFocus.current;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <SheetHeader>
            <SheetTitle className="pattern-title">{title ?? t('common:quick.title')}</SheetTitle>
            <SheetDescription>{description ?? t('common:quick.description')}</SheetDescription>
          </SheetHeader>
          <div className="pattern-quick-content">{children}</div>
          <SheetFooter>
            {cannotPreserveDestination ? (
              <>
                <Button disabled aria-describedby={unavailableReasonId}>
                  {t('common:quick.fullDetails')}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Button>
                <p id={unavailableReasonId} className="pattern-action-reason">
                  {interaction ? t('common:quick.noNavigationDraft') : t('common:quick.noNavigationDiscard')}
                </p>
              </>
            ) : (
              <Button asChild>
                <a
                  href={href}
                  onClick={event => {
                    if (dirty) {
                      event.preventDefault();
                      setPendingHref(href);
                      setConfirmClose(true);
                    } else {
                      onOpenChange(false);
                      if (onNavigate) {
                        event.preventDefault();
                        onNavigate(href);
                      }
                    }
                  }}
                >
                  {t('common:quick.fullDetails')}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <UnsavedGuard
        open={confirmClose}
        preserveDraft={Boolean(interaction)}
        onStay={() => {
          setConfirmClose(false);
          setPendingHref(null);
        }}
        onLeave={leave}
      />
    </>
  );
}
