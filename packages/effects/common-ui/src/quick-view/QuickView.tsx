import { useTranslation } from '@niubu/locales/react';
import { useContext, useId, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { ArrowUpRight } from '@niubu/icons';
import { InteractionContext } from '@niubu/stores';
import { useReturnPathResolver } from '../return-path';
import { Button } from '@niubu/shadcn-ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@niubu/shadcn-ui/sheet';
import { UnsavedGuard } from '../unsaved-guard';
import { captureOverlayFocus, restoreOverlayFocus } from '../overlay/focus-restoration';

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
  if ((!open && (confirmClose || pendingHref)) || (pendingHref && !onNavigate)) {
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
          className="pattern-quick-view w-[min(100vw,640px)] max-w-[min(100vw,640px)] sm:max-w-[min(100vw,640px)] gap-0"
          onOpenAutoFocus={() => {
            previousFocus.current = captureOverlayFocus();
          }}
          onCloseAutoFocus={event => {
            const target = returnFocusRef?.current ?? previousFocus.current;
            event.preventDefault();
            restoreOverlayFocus(target, event.target);
          }}
        >
          <SheetHeader className="border-b border-border pt-[26px] pr-[42px] pb-[22px] pl-[24px] [@media(max-width:700px)]:pl-[20px]">
            <SheetTitle className="text-[length:var(--workspace-title-font-size)] pattern-title min-w-0 [overflow-wrap:anywhere] break-normal leading-[1.35]">
              {title ?? t('common:quick.title')}
            </SheetTitle>
            <SheetDescription className="mt-[8px] text-[length:var(--workspace-caption-font-size)] leading-[1.8]">
              {description ?? t('common:quick.description')}
            </SheetDescription>
          </SheetHeader>
          <div className="pattern-quick-content min-h-0 flex-1 overflow-y-auto p-[var(--workspace-card-padding)] [overflow-wrap:anywhere]">
            {children}
          </div>
          <SheetFooter className="border-t border-border bg-card px-[24px] py-[18px]">
            {cannotPreserveDestination ? (
              <>
                <Button disabled aria-describedby={unavailableReasonId}>
                  {t('common:quick.fullDetails')}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Button>
                <p
                  id={unavailableReasonId}
                  className="pattern-action-reason mt-[7px] text-[length:var(--workspace-caption-font-size)] leading-[1.8] text-muted-foreground [overflow-wrap:anywhere]"
                >
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
