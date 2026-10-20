import { useEffect, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { StoresProvider } from '@niubu/stores/react';
import type { AppStores } from '@niubu/stores';
import { PreferenceProvider, type PreferenceManager } from '@niubu/preferences';
import { I18nProvider } from '@niubu/locales/react';
import type { AppI18n } from '@niubu/locales';
import type { StarterApi } from '../api';

import { OverlayProvider } from '@niubu/common-ui/overlay';
import { StarterAuthProvider } from '../auth/provider';
import type { StarterAuth } from '../auth/context';
import { StarterApiContext } from './api-context';
import { StarterShellContext, type StarterShellRuntime } from './shell-context';

export function StarterProviders({
  stores,
  preferences,
  i18n,
  queryClient,
  api,
  auth,
  onUnmount,
  children,
  shell,
}: {
  stores: AppStores;
  preferences: PreferenceManager;
  i18n: AppI18n;
  queryClient: QueryClient;
  api: StarterApi;
  auth: StarterAuth;
  onUnmount(): void;
  children: ReactNode;
  shell?: StarterShellRuntime;
}) {
  useEffect(() => onUnmount, [onUnmount]);
  return (
    <StoresProvider stores={stores}>
      <PreferenceProvider manager={preferences}>
        <I18nProvider instance={i18n}>
          <QueryClientProvider client={queryClient}>
            <StarterApiContext value={api}>
              <StarterAuthProvider auth={auth}>
                <StarterShellContext value={shell ?? null}>
                  {shell ? children : <OverlayProvider>{children}</OverlayProvider>}
                </StarterShellContext>
              </StarterAuthProvider>
            </StarterApiContext>
          </QueryClientProvider>
        </I18nProvider>
      </PreferenceProvider>
    </StoresProvider>
  );
}
