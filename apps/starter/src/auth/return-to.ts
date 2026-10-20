import { matchPath } from 'react-router-dom';
import { createReturnPathResolver } from '@niubu/utils';
import { registry } from '../modules/demo';
import { appConfig } from '../app/config';
import { readStarterScope } from './scope';

const resolve = createReturnPathResolver(
  (path, search) =>
    path !== '/login' &&
    registry.routes.some(route => matchPath({ path: route.path, end: true }, path)) &&
    readStarterScope(search, null).valid,
  appConfig.homeHref,
);
export const resolveStarterReturnTo = (raw: string | null) => resolve(raw, appConfig.homeHref);
