import { createContext, useContext } from 'react';
import { useTranslation } from '@niubu/locales/react';
import type { OverlayApi } from './types';

export const OverlayContext = createContext<OverlayApi | null>(null);

export function useOverlay(): OverlayApi {
  const api = useContext(OverlayContext);
  if (!api) throw new Error('useOverlay requires an OverlayProvider');
  return api;
}

export function useOverlayLabels() {
  const { t, locale } = useTranslation();
  const confirm = t('common:confirm');
  return {
    // The leader owns common resources; standalone use also has a localized label.
    confirm: confirm === 'common:confirm' ? (locale === 'en-US' ? 'Confirm' : '确定') : confirm,
    cancel: t('common:cancel'),
    close: t('common:close'),
  };
}
