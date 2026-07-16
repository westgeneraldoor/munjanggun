import { defineConfig, devices } from '@playwright/test'

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000',
        url: 'http://127.0.0.1:3000',
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'playwright-anon-key',
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
