import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 2, timeout: 90000, expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', testIgnore: [/secure-mode/, /narrative-reader/], use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 1024 } } },
    { name: 'mobile', testIgnore: [/secure-mode/, /narrative-reader/], use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'secure', testMatch: /secure-mode/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5174' } },
    { name: 'narrative-desktop', testMatch: /narrative-reader/, use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 1024 }, baseURL: 'http://127.0.0.1:5175' } },
    { name: 'narrative-mobile', testMatch: /narrative-reader/, use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', baseURL: 'http://127.0.0.1:5175' } },
  ],
  webServer: [
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', env: { VITE_VAULT_MODE: 'demo' }, reuseExistingServer: !process.env.CI, timeout: 120000 },
    { command: 'npm run dev -- --port 5174', url: 'http://127.0.0.1:5174', env: { VITE_VAULT_MODE: 'secure', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' }, reuseExistingServer: !process.env.CI, timeout: 120000 },
    { command: 'npm run dev -- --port 5175', url: 'http://127.0.0.1:5175', env: { VITE_VAULT_MODE: 'secure', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-browser-fixture-only' }, reuseExistingServer: !process.env.CI, timeout: 120000 },
  ],
})
