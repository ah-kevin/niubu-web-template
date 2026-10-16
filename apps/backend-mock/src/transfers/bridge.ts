import type { MockResponse } from '../dispatcher';

export type MockResponsePort = {
  setStatus(status: number): void;
  setHeader(name: string, value: string): void;
  end(body: string | Uint8Array): void;
};

/** The real Nitro adapter and its unit tests share this exact byte-sending boundary. */
export function sendMockResponse(response: MockResponse, port: MockResponsePort): void {
  port.setStatus(response.status);
  for (const [name, value] of Object.entries(response.headers ?? {})) port.setHeader(name, value);
  port.end(response.kind === 'binary' ? response.body : JSON.stringify(response.body));
}
