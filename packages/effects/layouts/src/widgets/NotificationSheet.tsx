import { useTranslation } from '@niubu/locales/react';
import { Info } from '@niubu/icons';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@niubu/shadcn-ui/sheet';
import type { NotificationDialogProps } from './types';
export default function NotificationSheet({
  contentId,
  onClose,
  returnFocus,
  items,
  renderLink,
  description,
  explanation,
}: NotificationDialogProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        closeLabel={t('common:close')}
        id={contentId}
        className="notification-sheet w-[min(430px,95vw)]"
        onCloseAutoFocus={event => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <SheetHeader className="shrink-0 border-b border-border px-[25px] pt-[29px] pb-[20px]">
          <SheetTitle>{t('shell:notificationCenter')}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="notification-list min-h-0 flex-1 overflow-y-auto overscroll-contain px-[25px] py-[8px]">
          {items.length === 0 && (
            <p role="status" className="py-10 text-center text-sm text-muted-foreground">
              {t('shell:notificationEmpty')}
            </p>
          )}
          {items.map(item => (
            <article className="flex gap-[12px]" key={item.id}>
              <span className="notification-icon grid size-[32px] shrink-0 place-items-center rounded-[8px] bg-secondary text-primary-text">
                <Info aria-hidden="true" size={20} />
              </span>
              <div>
                {item.label && (
                  <span className="eyebrow block text-[10px] font-[650] tracking-[1.5px] text-muted-foreground">
                    {item.label}
                  </span>
                )}
                <h3 className="my-[8px] text-[14px]">{item.title}</h3>
                <p className="text-[12px] leading-[1.8] text-muted-foreground">{item.body}</p>
                {(item.source || item.date) && (
                  <small className="mt-[14px] block text-[9px] text-muted-foreground">
                    {t('shell:notificationSource', { source: item.source ?? '', date: item.date ?? '' })}
                  </small>
                )}
                {item.action && (
                  <SheetClose asChild>
                    {renderLink({
                      href: item.action.href,
                      className: 'mt-[15px] inline-block text-[11px] text-primary-text underline underline-offset-4',
                      children: item.action.title,
                    })}
                  </SheetClose>
                )}
              </div>
            </article>
          ))}
        </div>
        {explanation && (
          <div className="notification-foot mx-[25px] mt-auto mb-[25px] shrink-0 border-t border-border pt-[18px] text-[10px] text-muted-foreground">
            {explanation}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
