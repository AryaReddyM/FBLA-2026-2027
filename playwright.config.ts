import { defineConfig, devices } from "@playwright/test"

// E2E tests sign in with the seeded demo accounts, so they need .env.local
// (Supabase keys + demo passwords) and `npm run db:seed` to have run.
try {
  process.loadEnvFile(".env.local")
} catch {
  // CI can provide the variables directly instead.
}

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
    { name: "setup", testMatch: /auth\.setup\.ts/ },
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
