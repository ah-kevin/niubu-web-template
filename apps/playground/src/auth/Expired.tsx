import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@niubu/shadcn-ui/dialog';
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
        showCloseButton={false}
        onEscapeKeyDown={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogTitle>{t('expired')}</DialogTitle>
        <DialogDescription>{t('expiredDescription')}</DialogDescription>
        <PendingOverlay onCancel={() => {}} />
        <LoginForm expired />
      </DialogContent>
    </Dialog>
  );
}
