import { createContext, useContext } from 'react';
import { createReturnPathResolver, type ReturnPathResolver } from '@niubu/core-shared';

const unbound = createReturnPathResolver(() => false, '/');
export const ReturnPathContext = createContext<ReturnPathResolver>(unbound);
export function useReturnPathResolver(): ReturnPathResolver {
  return useContext(ReturnPathContext);
}
