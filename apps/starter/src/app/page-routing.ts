import { createElement, useMemo } from 'react';
import { icons } from '../icons';
import {
  createPageIdentityResolver,
  type ResolvedPageDescriptor,
  type PageTypeReport,
  type PageLocation,
} from '@niubu/stores';
import { createRouteMatcher, pageIntentStateKey, type PageRoutingRuntime } from '@niubu/layouts/routing';
import { useTranslation } from '@niubu/locales/react';
import { registry } from '../modules/demo';
import { useAuthSnapshot } from '../auth/context';
import { resolveStarterAccess } from '../auth/access';
import { equalScope, readStarterScope, withScope } from '../auth/scope';
import { appIdentity } from './config';
const match = createRouteMatcher(registry.routes, id => /^[A-Za-z0-9_-]{1,120}$/.test(id));
/** Code-owned identity and the same current grants/scope that Guard uses. */
export function useStarterRouting(): PageRoutingRuntime {
  const state = useAuthSnapshot();
  const { t } = useTranslation('app');
  return useMemo(() => {
    const access = resolveStarterAccess(state);
    const resolver = createPageIdentityResolver({
      routes: registry.routes,
      findRoute: match,
      resolveScope(meta, search) {
        if (meta.scope === 'public') return { allowed: true, scope: null };
        const selected = readStarterScope(search, state.user);
        return state.status === 'ready' &&
          !state.loginExpired &&
          selected.valid &&
          equalScope(selected.scope, state.scope) &&
          access.grantedPageIds.includes(meta.id)
          ? { allowed: true, scope: state.scope }
          : { allowed: false };
      },
      resolveUrlView: () => undefined,
      policies: {},
      aliases: {},
      needsReport: () => false,
      isPageRoute: meta => meta.navigation || (meta.id.startsWith('starter.examples.') && meta.hideInMenu === true),
    });
    const describe = (location: PageLocation, report: PageTypeReport = {}) =>
      resolver.describePageLocation(location, null, null, report);
    return {
      describe,
      resolveTab(descriptor: ResolvedPageDescriptor) {
        // Descriptors may outlive a grant generation (e.g. admitted expiry presentation).
        // Never commit/retain them against the shell's current controller without fresh authorization.
        if (descriptor.status !== 'ready') return null;
        try {
          const current = describe(new URL(descriptor.href, 'https://starter.invalid'));
          const candidate = resolver.resolvePageTab(descriptor);
          const checked = resolver.resolvePageTab(current);
          return candidate && checked?.key === candidate.key && checked.routeId === candidate.routeId
            ? candidate
            : null;
        } catch {
          return null;
        }
      },
      home: scope => describe({ pathname: '/home', search: withScope('', scope), hash: '' }),
      renderTab: tab => {
        const route = registry.routes.find(r => r.id === tab.routeId);
        const Icon = icons.resolve(route?.iconToken ?? 'home');
        return {
          label: t(route?.titleKey ?? 'app:home'),
          icon: Icon ? createElement(Icon, { width: 14, height: 14, 'aria-hidden': true }) : undefined,
        };
      },
      isContentRoute: location => !!match(location.pathname, location.search),
      intentStateKey: pageIntentStateKey(appIdentity.storageNamespace),
    };
  }, [state, t]);
}
