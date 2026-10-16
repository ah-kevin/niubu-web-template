import { createRoutes } from '@niubu/layouts/routing';
import { registry } from './modules/demo';
import { appConfig } from './app/config';
import { BodyApp } from './app/BodyApp';
import { PlaygroundRoute } from './app/PlaygroundRoute';

export function createPlaygroundRoutes() {
  return createRoutes({
    routes: registry.routes,
    loaders: registry.loaders,
    homeHref: appConfig.homeHref,
    renderFrame: props => <PlaygroundRoute {...props} />,
    renderRoot: children => <BodyApp>{children}</BodyApp>,
  });
}
