import type { RequestOutcome } from './errors';
import type { DownloadFile, RequestClient, RequestSpec } from './types';
import { parseContentDispositionFilename } from './content-disposition';

/** Uses the same request client, credentials, renewal and cancellation owner as JSON requests. */
export function downloadBlob(
  client: RequestClient,
  spec: Omit<RequestSpec<DownloadFile>, 'decode' | 'responseType'>,
  fallbackName?: string,
): Promise<RequestOutcome<DownloadFile>> {
  return client.execute({
    ...spec,
    responseType: 'blob',
    decode(data, metadata) {
      if (!(data instanceof Blob) || !metadata || !metadata.headers['content-type'])
        throw Error('Download requires a Blob and HTTP response metadata');
      return {
        blob: data,
        filename: parseContentDispositionFilename(metadata.headers['content-disposition'] ?? null, fallbackName),
        contentType: metadata.headers['content-type'],
      };
    },
  });
}
