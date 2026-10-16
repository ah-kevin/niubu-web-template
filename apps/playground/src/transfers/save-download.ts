import type { DownloadFile } from '@niubu/request';

export type SaveDownloadPorts = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  activate(url: string, filename: string): void;
  scheduleRelease(release: () => void): () => void;
};

export function saveDownload(file: DownloadFile, ports: SaveDownloadPorts): () => void {
  const url = ports.createObjectURL(file.blob);
  let released = false;
  let cancelSchedule: (() => void) | undefined;
  const release = () => {
    if (released) return;
    released = true;
    try {
      cancelSchedule?.();
    } finally {
      ports.revokeObjectURL(url);
    }
  };
  try {
    ports.activate(url, file.filename);
    cancelSchedule = ports.scheduleRelease(release);
    if (released) cancelSchedule();
  } catch (error) {
    release();
    throw error;
  }
  return release;
}
