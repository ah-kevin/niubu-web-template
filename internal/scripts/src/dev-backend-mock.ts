import { resolve } from 'node:path';
import { createBackendOwner, parseBackendMockOptions } from './backend-process.ts';
const options = parseBackendMockOptions(process.argv.slice(2));
const owner = createBackendOwner({
  workspaceRoot: resolve(import.meta.dirname, '../../..'),
  enabled: true,
  ...options,
  onFailure: error => {
    console.error(error.message);
    process.exitCode = 1;
    void close();
  },
});
let closing: Promise<void> | undefined;
function close() {
  closing ??= owner.close().catch(error => {
    console.error(error instanceof Error ? error.message : 'Mock cleanup failed');
    process.exitCode = 1;
  });
  return closing;
}
process.once('SIGINT', () => {
  void close();
});
process.once('SIGTERM', () => {
  void close();
});
try {
  await owner.start();
  console.log(`Standalone mock ready at http://${options.host}:${options.port}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Mock startup failed');
  process.exitCode = 1;
  await close();
}
