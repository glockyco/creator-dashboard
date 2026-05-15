import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  {
    ignores: [
      '.svelte-kit/',
      '.wrangler/',
      '.tmp/',
      'build/',
      'dist/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'posts/'
    ]
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: { parser: ts.parser }
    }
  },
  {
    rules: {
      // Allow `any` in narrow places (typed test stubs, D1 mock shims, FetcherInput Env).
      // Tightening these is a follow-up; flagged-but-not-broken beats unenforced.
      '@typescript-eslint/no-explicit-any': 'off',
      // `_arg` style is used to mark intentionally-unused params in stubs/handlers.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The Env interface is augmented globally; some imports look unused to ESLint.
      'no-undef': 'off',
      // Visible-but-not-blocking: real Svelte 5 / SvelteKit cleanups handled in
      // separate commits (each-key may rewire DOM identity, resolve() rewrites
      // navigation, SvelteSet/SvelteDate touches reactivity).
      'svelte/require-each-key': 'warn',
      'svelte/no-navigation-without-resolve': 'warn',
      'svelte/prefer-svelte-reactivity': 'warn',
      'svelte/prefer-writable-derived': 'warn',
      'svelte/no-dom-manipulating': 'warn'
    }
  }
);
