import { fileURLToPath, URL } from 'node:url';
import { createEslintConfig } from '@niubu-internal/eslint-config';

export default createEslintConfig({ root: fileURLToPath(new URL('.', import.meta.url)) });
