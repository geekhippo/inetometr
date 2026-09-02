// Flat config для ESLint 9
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Browser
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        BlobEvent: 'readonly',
        FileReader: 'readonly',
        ReadableStreamDefaultReader: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        Image: 'readonly',
        SVGSVGElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLDialogElement: 'readonly',
        // Node (для тестов)
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
];
