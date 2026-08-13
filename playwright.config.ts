import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Hanya unit test (.test.mjs). E2E .spec.ts menarget arsitektur lama (SSO ZOne,
  // route /kasir 404) & nembak mutasi data prod — dikeluarkan dari koleksi tes.
  testMatch: ['**/*.test.mjs'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: process.env.BASE_URL || 'https://zpos.zomet.my.id',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // webServer disabled - testing against production
  // webServer: process.env.CI ? undefined : {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
