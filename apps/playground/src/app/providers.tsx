import { useEffect, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { StoresProvider } from '@niubu/stores/react';
import type { AppStores } from '@niubu/stores';
import { PreferenceProvider, type PreferenceManager } from '@niubu/preferences';
import { I18nProvider } from '@niubu/locales/react';
import type { AppI18n } from '@niubu/locales';
import type { PlaygroundApi } from '../api';

import { OverlayProvider } from '@niubu/common-ui/overlay';
import { PlaygroundAuthProvider } from '../auth/provider';
import type { PlaygroundAuth } from '../auth/context';
import { PlaygroundApiContext } from './api-context';
import { PlaygroundShellContext, type PlaygroundShellRuntime } from './shell-context';

export function PlaygroundProviders({
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
  api: PlaygroundApi;
  auth: PlaygroundAuth;
  onUnmount(): void;
  children: ReactNode;
  shell?: PlaygroundShellRuntime;
}) {
  useEffect(() => onUnmount, [onUnmount]);
  return (
    <StoresProvider stores={stores}>
      <PreferenceProvider manager={preferences}>
        <I18nProvider instance={i18n}>
          <QueryClientProvider client={queryClient}>
            <PlaygroundApiContext value={api}>
              <PlaygroundAuthProvider auth={auth}>
                <PlaygroundShellContext value={shell ?? null}>
                  {shell ? children : <OverlayProvider>{children}</OverlayProvider>}
                </PlaygroundShellContext>
              </PlaygroundAuthProvider>
            </PlaygroundApiContext>
          </QueryClientProvider>
        </I18nProvider>
      </PreferenceProvider>
    </StoresProvider>
  );
}
