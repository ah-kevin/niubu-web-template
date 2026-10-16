import type { RequestError } from './errors';

export const ACCESS_EXPIRED_CODE = 'ACCESS_EXPIRED';
export function isAccessExpired(error: RequestError): boolean {
  return error.kind === 'http' && error.status === 401 && error.code === ACCESS_EXPIRED_CODE;
}
