import ts from 'typescript';
import { fileURLToPath } from 'node:url';

for (const name of ['base', 'node', 'react', 'app']) {
  const file = fileURLToPath(new URL(`./${name}.json`, import.meta.url));
  const { config, error } = ts.readConfigFile(file, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, fileURLToPath(new URL('.', import.meta.url)));
  const errors = [error, ...parsed.errors].filter(error => error && error.code !== 18003);
  if (errors.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(errors, {
        getCanonicalFileName: file => file,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      }),
    );
}
