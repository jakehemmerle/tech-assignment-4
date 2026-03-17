import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npx serve ../bv-pages -l 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
