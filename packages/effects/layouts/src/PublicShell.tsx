import { PublicLayout, type PublicLayoutProps } from '@niubu/layout-ui';
import { usePreferenceSnapshot } from '@niubu/preferences';
import { useTranslation } from '@niubu/locales/react';
export function PublicShell(props: Omit<PublicLayoutProps, 'density' | 'sidebarCollapsed' | 'skipContent'>) {
  const { core } = usePreferenceSnapshot();
  const { t } = useTranslation('shell');
  return (
    <PublicLayout
      {...props}
      density={core.density}
      sidebarCollapsed={core.sidebar.collapsed}
      skipContent={t('skipContent')}
    />
  );
}
