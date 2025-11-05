import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['test/setupEnv.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      exclude: ['dist/**', 'tests/helpers/**', 'examples/**', '**/*.d.ts', 'vitest.config.ts'],
      lines: 60,
      functions: 60,
      branches: 50,
      statements: 60
    }
  }
});
