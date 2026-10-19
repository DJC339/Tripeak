import { defineConfig } from "@playwright/test";

// Runs against the production build in _site (run `npm run build` first),
// served with the CSP and security headers from netlify.toml.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:8080",
    browserName: "chromium",
  },
  webServer: {
    command: "node scripts/serve.mjs",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
  },
});
