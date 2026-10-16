import { createContext } from 'react';
import type { AppI18n } from './instance';
export const I18nContext = createContext<AppI18n | null>(null);
