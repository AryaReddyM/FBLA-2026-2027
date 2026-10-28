import { mkdirSync } from "node:fs"

import { expect, test as setup } from "@playwright/test"

import { createTestAccounts, createTestAsset, deleteTestAccounts, testEnv } from "../support/test-accounts"
import { storageFor } from "./helpers"

setup("create test accounts and sign in as each role", async ({ page }) => {
  setup.skip(!testEnv().configured, "Supabase keys aren't set in .env.local")
  setup.setTimeout(240_000)

  await deleteTestAccounts()
  const accounts = await createTestAccounts()
  await createTestAsset(accounts.find((a) => a.role === "admin")!.id, "Test projector")
  mkdirSync("tests/e2e/.auth", { recursive: true })

  for (const account of accounts) {
    await page.context().clearCookies()
    await page.goto("/login")
    await page.locator("#field-email").first().fill(account.email)
    await page.locator("input#field-password").fill(account.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/localhost:\d+\/$/)
    await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible()
    await page.context().storageState({ path: storageFor(account.role) })
  }
})
