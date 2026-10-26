import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false, // tests share one seeded database
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, viewport: { width: 1536, height: 1024 }, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1536, height: 1024 } } }],
  webServer: { command: "npm run dev", url: `${baseURL}/login`, reuseExistingServer: true, timeout: 180_000 },
});
