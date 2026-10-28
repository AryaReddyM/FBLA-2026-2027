import { expect, test as setup } from "@playwright/test"

import { ACCOUNTS, storageFor } from "./helpers"

// Signs in once per demo role and saves the session, so the other tests start signed in.
for (const account of ACCOUNTS) {
  setup(`sign in as ${account.role}`, async ({ page }) => {
    setup.skip(!account.password, "Demo passwords aren't set in .env.local")
    await page.goto("/login")
    await page.locator("#field-email").first().fill(account.email)
    await page.locator("input#field-password").fill(account.password!)
    await page.getByRole("button", { name: "Sign in" }).click()
    // The login page also says "Welcome back", so wait for the dashboard itself.
    await expect(page).toHaveURL(/localhost:\d+\/$/)
    await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible()
    await page.context().storageState({ path: storageFor(account.role) })
  })
}
