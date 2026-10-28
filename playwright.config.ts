import { existsSync } from "node:fs"

import { defineConfig, devices } from "@playwright/test"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const PORT = Number(process.env.E2E_PORT ?? 3000)

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "cleanup" },
    { name: "cleanup", testMatch: /cleanup\.teardown\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"], testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["setup"], testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_USE_DEV ? "npm run dev" : "npm run build && npm run start",
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
})
