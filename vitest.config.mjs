import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Two kinds of tests: pure logic and real-browser tests run in plain Node (the browser tests drive
    // Chromium through Playwright); screen tests run in happy-dom.
    projects: [
      { test: { name: 'logic', environment: 'node', include: ['packages/*/test/*.test.mjs', 'examples/*/test/*.test.mjs', 'test/*.test.mjs'], testTimeout: 20000 } },
      { test: { name: 'screens', environment: 'happy-dom', include: ['packages/**/*.spec.{mjs,js,ts}', 'examples/**/*.spec.{mjs,js,ts}'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.js'],
      exclude: ['packages/cli/src/cli.js'], // thin wrapper, covered through the CLI test
      reporter: ['text-summary', 'text', 'html'],
      // Set just under the measured values (stmts 90.6, branches 82.2, funcs 91.6, lines 94.7) so a drop fails CI.
      thresholds: {
        statements: 88, branches: 79, functions: 88, lines: 92,
        'packages/core/src/**': { statements: 94, branches: 85, functions: 90, lines: 96 },
      },
    },
  },
});
