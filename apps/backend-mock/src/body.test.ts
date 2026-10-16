import { Readable } from 'node:stream';
import { expect, it } from 'vitest';
import { readRequestBody } from './body';

it('reads JSON split across UTF-8 chunks without corrupting characters', async () => {
  const bytes = Buffer.from('{"value":"中文"}');
  expect(await readRequestBody(Readable.from([bytes.subarray(0, 11), bytes.subarray(11)]))).toBe('{"value":"中文"}');
});

it('rejects streams at the byte limit without buffering the remaining chunks', async () => {
  let consumed = 0;
  async function* chunks() {
    for (let index = 0; index < 10; index++) {
      consumed++;
      yield Buffer.alloc(32_768, 'a');
    }
  }
  await expect(readRequestBody(chunks())).rejects.toMatchObject({ status: 413, code: 'BODY_TOO_LARGE' });
  expect(consumed).toBe(3);
});

it('accepts exactly 65536 streamed UTF-8 bytes and rejects byte 65537', async () => {
  expect(Buffer.byteLength(await readRequestBody(Readable.from([Buffer.alloc(65_536)])))).toBe(65_536);
  await expect(readRequestBody(Readable.from([Buffer.alloc(65_536), Buffer.alloc(1)]))).rejects.toMatchObject({
    status: 413,
    code: 'BODY_TOO_LARGE',
  });
});
