import { createRoutes } from '@niubu/layouts/routing';
import { registry } from './modules/demo';
import { appConfig } from './app/config';
import { BodyApp } from './app/BodyApp';
import { StarterRoute } from './app/StarterRoute';

export function createStarterRoutes() {
  return createRoutes({
    routes: registry.routes,
    loaders: registry.loaders,
    homeHref: appConfig.homeHref,
    renderFrame: props => <StarterRoute {...props} />,
    renderRoot: children => <BodyApp>{children}</BodyApp>,
  });
}
