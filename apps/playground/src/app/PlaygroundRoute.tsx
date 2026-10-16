import { Suspense, type ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { RouteMotion, RoutePending, RoutePresentation } from '@niubu/layouts/routing';
import { useTranslation } from '@niubu/locales/react';
import { registry } from '../modules/demo';
import { Guard } from '../auth/Guard';
import { appConfig } from './config';

export function PlaygroundRoute({ path, registered: Registered }: { path: string; registered?: ComponentType }) {
  const { t } = useTranslation('app');
  const location = useLocation();
  const route = registry.routes.find(route => route.path === path);
  const title = route ? t(route.titleKey) : t('notFound');
  return (
    <RoutePresentation title={title} generation={location.key} appTitle={appConfig.displayName}>
      <RouteMotion identity={path} refreshNonce={0}>
        <Suspense fallback={<RoutePending />}>
          {Registered ? (
            <Guard meta={route!}>
              <Registered />
            </Guard>
          ) : (
            <section className="playground-page">
              <h1>{t('notFound')}</h1>
            </section>
          )}
        </Suspense>
      </RouteMotion>
    </RoutePresentation>
  );
}
