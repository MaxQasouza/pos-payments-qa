import { defineConfig, devices } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const MOCK_URL = 'http://localhost:4010';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0, // pagamento não combina com teste "flaky mascarado": falhou, investiga.
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: API_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'mobile', testDir: './tests/ui', use: { ...devices['Pixel 7'] } },
    { name: 'db', testDir: './tests/db' },
  ],
  // Sobe o mock do autorizador e a API automaticamente. As variáveis do ambiente
  // (BUG_MODE, DB_MODE, DB_*) são herdadas pelo processo da API.
  webServer: [
    {
      command: 'npm run start:mock',
      url: `${MOCK_URL}/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: 'npm run start',
      url: `${API_URL}/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: { ENABLE_TEST_ROUTES: '1', LOG_SILENT: '1' },
    },
  ],
});
