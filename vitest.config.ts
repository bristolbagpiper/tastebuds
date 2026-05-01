import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
  test: {
    coverage: {
      exclude: [
        '**/*.config.*',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        'tests/**',
      ],
      include: ['lib/app/event-visibility.ts'],
      provider: 'v8',
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup/vitest.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
