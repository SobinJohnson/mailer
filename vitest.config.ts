import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Node environment for API route and utility tests
    environment: 'node',

    // Global test setup file
    setupFiles: ['__tests__/setup.ts'],

    // Test file patterns
    include: ['__tests__/**/*.test.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: [
        'lib/**/*.ts',
        'app/api/**/*.ts',
      ],
      exclude: [
        'lib/supabase/client.ts',
        '**/*.d.ts',
        'node_modules/**',
      ],
      // Report coverage at the end of each run
      reportOnFailure: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
