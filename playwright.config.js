// playwright.config.js — browser verification against a separate, explicitly configured test server.
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true },
  webServer: { command: 'npm run dev -- --port 4174 --strictPort', url: 'http://127.0.0.1:4174', reuseExistingServer: false, env: { VITE_GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com' } },
});
