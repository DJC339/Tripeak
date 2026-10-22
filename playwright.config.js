import { defineConfig } from "@playwright/test";

// Runs against the production build in _site (run `npm run build` first),
// served with the headers from netlify.toml. Uses its own port so it never
// collides with the Eleventy dev server (8080).
const PORT = Number(process.env.TEST_PORT || 8181);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
  },
  webServer: {
    command: "node scripts/serve.mjs",
    url: `http://localhost:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
});
