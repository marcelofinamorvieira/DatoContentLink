import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['test/setupEnv.ts'],
    coverage: {
      enabled: false
    }
  }
});
