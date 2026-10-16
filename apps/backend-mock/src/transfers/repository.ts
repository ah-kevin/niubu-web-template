import { TransferError } from './contracts';
import type { TransferFile, TransferOwner, TransferPart, UploadAck, UploadDescriptor } from './contracts';

const MAX_PART_BYTES = 32_768;
const MAX_FILE_BYTES = 1_048_576;
const MAX_SESSIONS = 16;
const MAX_TOTAL_BYTES = 16 * MAX_FILE_BYTES;
const TTL_MS = 300_000;
const TOKEN = "[!#$%&'*+.^_`|~0-9A-Za-z-]+";
const MEDIA_TYPE = new RegExp(`^${TOKEN}/${TOKEN}`);
const PARAMETER = new RegExp(`^; *(${TOKEN})=(${TOKEN}|"(?:[ !#-\\[\\]-~]|\\\\[ -~])*")`);

interface StoredPart {
  bytes: Buffer;
  offset: number;
  ack: UploadAck;
}

interface Session {
  ownerKey: string;
  file: TransferFile;
  expiresAt: number;
  parts: StoredPart[];
  acknowledgedBytes: number;
  completed: boolean;
}

function ownerKey(owner: TransferOwner): string {
  if (
    !owner ||
    typeof owner.identityKey !== 'string' ||
    !owner.identityKey ||
    owner.scope?.kind !== 'workspace' ||
    typeof owner.scope.id !== 'string' ||
    !owner.scope.id
  )
    throw new TransferError(400, 'INVALID_OWNER', 'A verified workspace owner is required');
  return JSON.stringify([owner.identityKey, owner.scope.kind, owner.scope.id]);
}

function validateContentType(value: string): string {
  if (value === '') return 'application/octet-stream';
  if (typeof value !== 'string' || value.length > 127 || /[^\x20-\x7e]/.test(value)) {
    throw new TransferError(400, 'INVALID_METADATA', 'Invalid source media type');
  }
  const mediaType = MEDIA_TYPE.exec(value);
  if (!mediaType) throw new TransferError(400, 'INVALID_METADATA', 'Invalid source media type');
  let rest = value.slice(mediaType[0].length);
  const names = new Set<string>();
  while (rest) {
    const parameter = PARAMETER.exec(rest);
    const name = parameter?.[1]?.toLowerCase();
    if (!parameter || !name || names.has(name)) {
      throw new TransferError(400, 'INVALID_METADATA', 'Invalid source media type parameter');
    }
    names.add(name);
    rest = rest.slice(parameter[0].length);
  }
  return value;
}

function validateDescriptor(input: UploadDescriptor): UploadDescriptor {
  if (
    !input ||
    typeof input.name !== 'string' ||
    Buffer.byteLength(input.name, 'utf8') > 255 ||
    Buffer.from(input.name, 'utf8').toString('utf8') !== input.name ||
    !Number.isSafeInteger(input.size) ||
    input.size < 0 ||
    input.size > MAX_FILE_BYTES
  )
    throw new TransferError(400, 'INVALID_METADATA', 'Invalid transfer filename or size');
  return { name: input.name, size: input.size, contentType: validateContentType(input.contentType) };
}

function decodePart(base64: string): Buffer {
  if (typeof base64 !== 'string' || base64.length === 0 || base64.length > 43_692) {
    throw new TransferError(400, 'INVALID_PART', 'Invalid transfer part encoding or length');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_PART_BYTES || bytes.toString('base64') !== base64) {
    throw new TransferError(400, 'INVALID_PART', 'Transfer part must use canonical base64');
  }
  return bytes;
}

export function createTransferRepository(options: { now: () => number; randomId: () => string }) {
  const sessions = new Map<string, Session>();
  let reservedBytes = 0;
  let disposed = false;

  function release(id: string, session: Session) {
    reservedBytes -= session.file.size;
    session.parts.length = 0;
    sessions.delete(id);
  }

  function prepare(): number {
    if (disposed) throw new TransferError(503, 'DISPOSED', 'Transfer repository is closed');
    const now = options.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) release(id, session);
    }
    return now;
  }

  function get(owner: TransferOwner, id: string): Session {
    prepare();
    const key = ownerKey(owner);
    const session = sessions.get(id);
    if (!session || session.ownerKey !== key) throw new TransferError(404, 'NOT_FOUND', 'Transfer not found');
    return session;
  }

  return {
    begin(owner: TransferOwner, input: UploadDescriptor): { uploadId: string } {
      const now = prepare();
      const key = ownerKey(owner);
      const metadata = validateDescriptor(input);
      const owned = [...sessions.values()].filter(session => session.ownerKey === key).length;
      if (owned >= 2 || sessions.size >= MAX_SESSIONS || reservedBytes + metadata.size > MAX_TOTAL_BYTES) {
        throw new TransferError(429, 'TRANSFER_LIMIT', 'Transfer session or byte quota exceeded');
      }
      const id = options.randomId();
      if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id) || sessions.has(id)) {
        throw new TransferError(409, 'ID_CONFLICT', 'Transfer ID is unavailable');
      }
      sessions.set(id, {
        ownerKey: key,
        file: { id, ...metadata },
        parts: [],
        acknowledgedBytes: 0,
        completed: false,
        expiresAt: now + TTL_MS,
      });
      // Reserve the declared size so pending and completed transfers share one hard memory bound.
      reservedBytes += metadata.size;
      return { uploadId: id };
    },
    chunk(owner: TransferOwner, input: TransferPart): UploadAck {
      const session = get(owner, input.uploadId);
      if (
        !Number.isSafeInteger(input.index) ||
        input.index < 0 ||
        !Number.isSafeInteger(input.offset) ||
        input.offset < 0
      ) {
        throw new TransferError(400, 'INVALID_PART', 'Part index and offset must be safe nonnegative integers');
      }
      const bytes = decodePart(input.base64);
      const previous = session.parts[input.index];
      if (previous) {
        if (previous.offset !== input.offset || !previous.bytes.equals(bytes)) {
          throw new TransferError(409, 'PART_CONFLICT', 'Part retry differs from the acknowledged part');
        }
        return { ...previous.ack };
      }
      if (session.completed || input.index !== session.parts.length || input.offset !== session.acknowledgedBytes) {
        throw new TransferError(409, 'PART_CONFLICT', 'Part is out of order or transfer is complete');
      }
      const remaining = session.file.size - session.acknowledgedBytes;
      if (bytes.length !== Math.min(MAX_PART_BYTES, remaining)) {
        throw new TransferError(400, 'INVALID_PART', 'Part length must match the remaining serial chunk');
      }
      const ack = { index: input.index, acknowledgedBytes: session.acknowledgedBytes + bytes.length };
      session.parts.push({ bytes, offset: input.offset, ack });
      session.acknowledgedBytes = ack.acknowledgedBytes;
      return { ...ack };
    },
    complete(owner: TransferOwner, id: string): TransferFile {
      const session = get(owner, id);
      if (session.acknowledgedBytes !== session.file.size) {
        throw new TransferError(409, 'INCOMPLETE_TRANSFER', 'Transfer bytes do not match the declared size');
      }
      session.completed = true;
      return { ...session.file };
    },
    cancel(owner: TransferOwner, id: string): null {
      release(id, get(owner, id));
      return null;
    },
    download(owner: TransferOwner, id: string): { bytes: Uint8Array; name: string; contentType: string } {
      const session = get(owner, id);
      if (!session.completed) throw new TransferError(409, 'TRANSFER_NOT_READY', 'Transfer is not complete');
      // Parts remain the sole retained byte source; each consumer owns a fresh download copy.
      const bytes = new Uint8Array(session.file.size);
      for (const part of session.parts) bytes.set(part.bytes, part.offset);
      return { bytes, name: session.file.name, contentType: session.file.contentType };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const [id, session] of sessions) release(id, session);
    },
  };
}

export type TransferRepository = ReturnType<typeof createTransferRepository>;
