import { resolveAccess } from '@niubu/access';
import type { AuthSessionSnapshot } from '@niubu/stores';
import type { BackendMenuItem } from '@niubu/types';
import { registry } from '../modules/demo';
import { appConfig } from '../app/config';
import type { StarterUser } from './schemas';

export function resolveStarterAccess(
  state: AuthSessionSnapshot<StarterUser>,
  anonymousMenu: readonly BackendMenuItem[] = [],
) {
  return resolveAccess({
    mode: appConfig.mode,
    routes: registry.routes,
    frontendMenu: registry.menus,
    backendMenu: state.user ? state.menu : anonymousMenu,
    access: { scopes: state.user?.workspaces ?? [], capabilities: state.codes },
    roles: state.user?.roles ?? [],
    codes: state.codes,
    scope: state.scope,
    authenticated: state.user !== null,
    baseURL: window.location.origin,
  });
}
