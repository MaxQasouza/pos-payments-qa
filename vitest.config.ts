import { defineConfig } from 'vitest/config';

// Vitest roda apenas os testes de contrato (Pact). API/UI/DB ficam no Playwright.
export default defineConfig({
  test: {
    include: ['tests/contract/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
