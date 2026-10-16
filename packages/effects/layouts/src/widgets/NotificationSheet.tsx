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
        className="notification-sheet"
        onCloseAutoFocus={event => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <SheetHeader>
          <SheetTitle>{t('shell:notificationCenter')}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="notification-list">
          {items.map(item => (
            <article key={item.id}>
              <span className="notification-icon">
                <Info aria-hidden="true" size={20} />
              </span>
              <div>
                {item.label && <span className="eyebrow">{item.label}</span>}
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {(item.source || item.date) && (
                  <small>{t('shell:notificationSource', { source: item.source ?? '', date: item.date ?? '' })}</small>
                )}
                {item.action && (
                  <SheetClose asChild>{renderLink({ href: item.action.href, children: item.action.title })}</SheetClose>
                )}
              </div>
            </article>
          ))}
        </div>
        {explanation && <div className="notification-foot">{explanation}</div>}
      </SheetContent>
    </Sheet>
  );
}
