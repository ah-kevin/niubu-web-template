import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

import type { ESLint, Linter } from 'eslint';
import { readWorkspace } from '@niubu-internal/node-utils';
import { createArchitectureRule } from './architecture.ts';

export function createEslintConfig(options: { root: string }): Linter.Config[] {
  return [
    {
      ignores: [
        '**/dist/**',
        '**/node_modules/**',
        '**/.turbo/**',
        '**/.nitro/**',
        '**/.output/**',
        '.pnpm-store/**',
        '.superpowers/**',
        '.verification-private/**',
        'playwright-report/**',
        'test-results/**',
      ],
    },
    js.configs.recommended,
    { files: ['**/*.{js,mjs,cjs}'], languageOptions: { globals: globals.node } },
    ...tseslint.configs.recommended,
    {
      files: ['**/*.{ts,tsx}', '**/src/**/*.{js,jsx,mjs,cjs,mts,cts}'],
      languageOptions: {
        globals: { ...globals.browser, ...globals.node },
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: {
        'react-hooks': reactHooks as unknown as ESLint.Plugin,
        'react-refresh': reactRefresh,
        architecture: { rules: { 'import-boundaries': createArchitectureRule(readWorkspace(options.root)) } },
      },
      rules: {
        'architecture/import-boundaries': 'error',
        ...reactHooks.configs.recommended.rules,
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
  ];
}
