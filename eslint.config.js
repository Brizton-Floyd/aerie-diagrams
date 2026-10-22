// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'test-results/', 'playwright-report/', 'blob-report/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', 'src/cli/**/*.ts', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
  {
    // The Lines language is pure TypeScript: no DOM and no Node (docs/spec/language.md).
    files: ['src/lines/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['node:*', '../*'] }],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'process', 'require'],
    },
  },
  {
    // Model semantics are pure TypeScript too, built only on the Lines language (docs/spec/model.md).
    files: ['src/model/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*'] }, { regex: String.raw`^\.\./(?!lines/index\.ts$)` }] },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'process', 'require'],
    },
  },
);
