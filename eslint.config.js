// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// LAYOUT-002: only the ELK adapter imports `elkjs`, so another engine is one more adapter. Each
// block below that sets `no-restricted-imports` replaces the one before it, so each repeats this.
const ELK_MESSAGE = 'Only the ELK adapter (src/layout/elk/) imports elkjs (LAYOUT-002).';
const ELK_PATH = { name: 'elkjs', message: ELK_MESSAGE };
const ELK_PATTERN = { group: ['elkjs/*'], message: ELK_MESSAGE };

// Pure modules run anywhere: no DOM and no Node.
const NODE = { group: ['node:*'] };
/** @type {['error', ...string[]]} */
const PURE_GLOBALS = ['error', 'window', 'document', 'navigator', 'process', 'require'];
// Layout builds only on the entry points of the language and the model.
const LAYOUT_UP = { regex: String.raw`^\.\./(?!(?:lines|model)/index\.ts$)` };
const LAYOUT_UP_TWO = { regex: String.raw`^\.\./\.\./(?!(?:lines|model)/index\.ts$)` };
// The extractor builds only on the entry point of the language.
const EXTRACT_UP = { regex: String.raw`^\.\./(?!lines/index\.ts$)` };
const EXTRACT_UP_TWO = { regex: String.raw`^\.\./\.\./(?!lines/index\.ts$)` };
// Drift builds only on the entry points of the language, the model and the extractor.
const DRIFT_UP = { regex: String.raw`^\.\./(?!(?:lines|model|extract)/index\.ts$)` };

export default defineConfig(
  {
    ignores: [
      'dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      // The extractor's and drift's fixture projects hold other projects' code as written.
      'tests/unit/extract/fixtures/',
      'tests/unit/drift/fixtures/',
    ],
  },
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
    ignores: ['src/layout/elk/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: [ELK_PATH], patterns: [ELK_PATTERN] }],
    },
  },
  {
    // The Lines language is pure TypeScript: no DOM and no Node (docs/spec/language.md).
    files: ['src/lines/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [ELK_PATH], patterns: [{ group: ['node:*', '../*'] }, ELK_PATTERN] },
      ],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
  {
    // Model semantics are pure TypeScript too, built only on the Lines language (docs/spec/model.md).
    files: ['src/model/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [ELK_PATH],
          patterns: [NODE, { regex: String.raw`^\.\./(?!lines/index\.ts$)` }, ELK_PATTERN],
        },
      ],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
  {
    // Layout is pure as well, so it runs in Node, the browser and a Web Worker alike, built only on
    // the language and the model (docs/spec/layout.md).
    files: ['src/layout/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [ELK_PATH], patterns: [NODE, LAYOUT_UP, ELK_PATTERN] },
      ],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
  {
    files: ['src/layout/*/**/*.ts'],
    ignores: ['src/layout/elk/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [ELK_PATH], patterns: [NODE, LAYOUT_UP_TWO, ELK_PATTERN] },
      ],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
  {
    // The renderer is pure too, so drawings are the same in Node and the browser, built only on the
    // language, the model and the layout (docs/spec/look.md).
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [ELK_PATH],
          patterns: [
            NODE,
            { regex: String.raw`^\.\./(?!(?:lines|model|layout)/index\.ts$)` },
            ELK_PATTERN,
          ],
        },
      ],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
  {
    // The extractor is pure too, so it reads a project only through `ProjectFiles`, built only on
    // the language (docs/spec/drift.md, DRIFT-001).
    files: ['src/extract/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [ELK_PATH], patterns: [NODE, EXTRACT_UP, ELK_PATTERN] },
      ],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
  {
    files: ['src/extract/*/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [ELK_PATH], patterns: [NODE, EXTRACT_UP_TWO, ELK_PATTERN] },
      ],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
  {
    // Drift is pure too: it compares a model with the extractor's facts and reads nothing itself
    // (docs/spec/drift.md, section 5).
    files: ['src/drift/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [ELK_PATH], patterns: [NODE, DRIFT_UP, ELK_PATTERN] },
      ],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
  {
    // The ELK adapter is the one place `elkjs` may be imported.
    files: ['src/layout/elk/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [NODE, LAYOUT_UP_TWO] }],
      'no-restricted-globals': PURE_GLOBALS,
    },
  },
);
