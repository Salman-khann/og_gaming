import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3119',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3119',
    url: 'http://127.0.0.1:3119',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      OG_BROWSER_TEST: '1',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'browser-test-placeholder',
      SUPABASE_SERVICE_ROLE_KEY: 'browser-test-placeholder',
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3119',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'browser-test-site-key',
      TURNSTILE_SECRET_KEY: 'browser-test-secret',
    },
  },
});
