import type { DownloadFile, RequestOutcome, UploadProgress, UploadSource } from '@niubu/request';
import type { AuthContext } from '@niubu/types';

export type TransferFile = Readonly<{ id: string; name: string; size: number; contentType: string }>;
export type TransferApi = {
  upload(
    context: AuthContext,
    source: UploadSource,
    options: { signal: AbortSignal; onProgress?: (progress: UploadProgress) => void },
  ): Promise<RequestOutcome<TransferFile>>;
  download(context: AuthContext, id: string, signal?: AbortSignal): Promise<RequestOutcome<DownloadFile>>;
};
