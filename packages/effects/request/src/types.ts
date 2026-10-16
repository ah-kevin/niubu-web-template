import type { RequestError, RequestOutcome } from './errors';

// Use the host fetch types in both Node and browsers without loading DOM globals.
type BodyInit = NonNullable<RequestInit['body']>;
type HeadersInit = NonNullable<RequestInit['headers']>;

export type ResponseMetadata = Readonly<{
  status: number;
  headers: Readonly<Record<string, string>>;
  requestId?: string;
  traceId?: string;
}>;

export type DownloadFile = Readonly<{ blob: Blob; filename: string; contentType: string }>;

export type UploadSource = {
  name: string;
  contentType: string;
  size: number;
  read(start: number, end: number, signal: AbortSignal): Promise<Uint8Array>;
};
export type UploadDescriptor = Pick<UploadSource, 'name' | 'contentType' | 'size'>;
export type UploadAck = { index: number; acknowledgedBytes: number };
export type UploadProgress = {
  acknowledgedBytes: number;
  totalBytes: number;
  phase: 'uploading' | 'completing' | 'complete';
};
export type UploadPorts<R> = {
  begin(input: UploadDescriptor, signal: AbortSignal): Promise<RequestOutcome<{ uploadId: string }>>;
  chunk(
    input: { uploadId: string; index: number; offset: number; base64: string },
    signal: AbortSignal,
  ): Promise<RequestOutcome<UploadAck>>;
  complete(uploadId: string, signal: AbortSignal): Promise<RequestOutcome<R>>;
  cancel(uploadId: string, signal: AbortSignal): Promise<RequestOutcome<void>>;
};

export type RequestSpec<T> = {
  path: string;
  method: string;
  /** Native fetch body; apps encode JSON and set its Content-Type explicitly. */
  body?: BodyInit | null;
  headers?: HeadersInit;
  query?:
    | URLSearchParams
    | Readonly<Record<string, string | number | boolean | null | undefined | readonly (string | number | boolean)[]>>;
  signal?: AbortSignal;
  activity: 'foreground' | 'background';
  responseType?: 'json' | 'blob';
  decode: (data: unknown, metadata?: ResponseMetadata) => T | Promise<T>;
  allowReplay?: boolean;
};
export type RequestClient = {
  readonly mode: 'disabled' | 'enabled';
  execute<T>(spec: RequestSpec<T>): Promise<RequestOutcome<T>>;
  dispose(): void;
};
export type RenewalPolicy = {
  shouldRenew: (error: RequestError) => boolean;
  renew: (signal: AbortSignal) => Promise<RequestOutcome<void>>;
};
export type EnabledRequestOptions = {
  mode: 'enabled';
  baseURL: string;
  fetch: typeof fetch;
  credentialsProvider: (
    signal: AbortSignal,
  ) => Pick<RequestInit, 'headers' | 'credentials'> | Promise<Pick<RequestInit, 'headers' | 'credentials'>>;
  activityReporter: () => void;
  errorNormalizer: (error: RequestError) => RequestError;
  getGeneration: () => number;
  renewal?: RenewalPolicy;
};
