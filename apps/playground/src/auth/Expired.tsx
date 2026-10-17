import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@niubu/shadcn-ui/dialog';
import { PendingOverlay } from '@niubu/layout-ui';
import { useTranslation } from '@niubu/locales/react';
import { useAuthSnapshot } from './context';
import { LoginForm } from './Login';
export function ExpiredLogin() {
  const state = useAuthSnapshot(),
    { t } = useTranslation('app');
  return (
    <Dialog open={state.loginExpired} onOpenChange={() => {}}>
      <DialogContent
        className="flex max-h-[calc(90dvh-1rem)] flex-col overflow-hidden"
        showCloseButton={false}
        onEscapeKeyDown={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('expired')}</DialogTitle>
          <DialogDescription>{t('expiredDescription')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-auto p-3">
          <PendingOverlay onCancel={() => {}} />
          <LoginForm expired />
        </div>
      </DialogContent>
    </Dialog>
  );
}
