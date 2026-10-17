import type { CorePreferences, DeepPartial } from '@niubu/core-preferences';
import type { PreferenceIdentity } from '@niubu/preferences/pure';

/** Anonymous public-demo identity; this is not an authenticated session. */
export const appIdentity: PreferenceIdentity = Object.freeze({
  storageNamespace: 'playground',
  product: 'template',
  appId: 'template-playground',
  environment: 'local',
  identityKey: 'anonymous',
});
export const appDefaults: DeepPartial<CorePreferences> = Object.freeze({
  theme: Object.freeze({ mode: 'system' }),
  tabbar: Object.freeze({ enabled: true }),
  copyright: Object.freeze({ companyName: 'Template Playground' }),
});
export const appPolicy: DeepPartial<CorePreferences> = Object.freeze({});
export const appConfig = Object.freeze({
  appId: appIdentity.appId,
  displayName: 'Template Playground',
  homeHref: '/home',
  mode: 'backend' as const,
});
