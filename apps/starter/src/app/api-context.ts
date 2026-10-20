import { createContext, useContext } from 'react';
import type { StarterApi } from '../api';

export const StarterApiContext = createContext<StarterApi | null>(null);
export function useStarterApi() {
  const api = useContext(StarterApiContext);
  if (!api) throw Error('Starter API provider is missing');
  return api;
}
