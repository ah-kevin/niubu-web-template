export interface TransferOwner {
  readonly identityKey: string;
  readonly scope: { readonly kind: 'workspace'; readonly id: string };
}

export interface TransferFile {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
}

export interface UploadDescriptor {
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
}

export interface TransferPart {
  readonly uploadId: string;
  readonly index: number;
  readonly offset: number;
  readonly base64: string;
}

export interface UploadAck {
  readonly index: number;
  readonly acknowledgedBytes: number;
}

export interface TransferRoute {
  readonly operation: 'begin' | 'chunk' | 'complete' | 'cancel' | 'download';
  readonly id?: string;
  readonly index?: number;
  readonly methods: readonly string[];
}

export class TransferError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'TransferError';
    this.status = status;
    this.code = code;
  }
}
