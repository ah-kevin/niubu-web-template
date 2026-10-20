import type { CorePreferences, DeepPartial } from '@niubu/core-preferences';
import type { PreferenceIdentity } from '@niubu/preferences/pure';

/** Startup identity is anonymous until authoritative restore completes. */
export const appIdentity: PreferenceIdentity = Object.freeze({
  storageNamespace: 'starter',
  product: 'starter',
  appId: 'template-starter',
  environment: 'local',
  identityKey: 'anonymous',
});
export const appDefaults: DeepPartial<CorePreferences> = Object.freeze({
  theme: Object.freeze({ mode: 'system' }),
  tabbar: Object.freeze({ enabled: true }),
  copyright: Object.freeze({ companyName: 'Admin Starter' }),
});
export const appPolicy: DeepPartial<CorePreferences> = Object.freeze({});
export const appConfig = Object.freeze({
  appId: appIdentity.appId,
  displayName: 'Admin Starter',
  homeHref: '/home',
  mode: 'backend' as const,
});
