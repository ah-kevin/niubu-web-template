import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
it('preserves actual child source config reload and shutdown through fake Nitro boundaries', () => {
  const probe=fileURLToPath(new URL('../test-support/child-lifecycle.mjs',import.meta.url));
  const result=spawnSync(process.execPath,['--experimental-vm-modules','--test',probe],{encoding:'utf8'});
  expect(result.status,result.stdout+result.stderr).toBe(0);
});
