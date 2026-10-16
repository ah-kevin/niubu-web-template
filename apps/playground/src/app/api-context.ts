import { createContext, useContext } from 'react';
import type { PlaygroundApi } from '../api';

export const PlaygroundApiContext = createContext<PlaygroundApi | null>(null);
export function usePlaygroundApi() {
  const api = useContext(PlaygroundApiContext);
  if (!api) throw Error('Playground API provider is missing');
  return api;
}
