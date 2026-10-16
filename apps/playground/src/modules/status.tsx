import type { RequestError } from '@niubu/request';

function describeRequestError(error: RequestError) {
  return [error.kind, error.status === undefined ? null : `HTTP ${error.status}`, error.code]
    .filter(Boolean)
    .join(' · ');
}
export function RequestFailure({ name, error }: { name: string; error: RequestError }) {
  return (
    <p role="alert">
      {name}: {describeRequestError(error)}
    </p>
  );
}
