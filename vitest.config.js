import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.js'],
      reporter: ['text', 'html'],
    },
  },
});
