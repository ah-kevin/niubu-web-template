import { AccountLayout, type AccountLayoutProps } from '@niubu/layout-ui';
import { usePreferenceSnapshot } from '@niubu/preferences';
import { useTranslation } from '@niubu/locales/react';
export function AccountShell(props: Omit<AccountLayoutProps, 'density' | 'sidebarCollapsed' | 'skipContent'>) {
  const { core } = usePreferenceSnapshot();
  const { t } = useTranslation('shell');
  return (
    <AccountLayout
      {...props}
      density={core.density}
      sidebarCollapsed={core.sidebar.collapsed}
      skipContent={t('skipContent')}
    />
  );
}
