import { expect, test } from "@playwright/test"

import { storageFor, waitForContent } from "./helpers"

// Runs on a phone-sized screen (see the "mobile" project in playwright.config.ts).
test.use({ storageState: storageFor("admin") })

for (const path of ["/", "/inventory", "/circulation", "/licenses", "/reports"]) {
  test(`no sideways page scrolling on a phone: ${path}`, async ({ page }) => {
    await page.goto(path)
    await waitForContent(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}

test("navigation becomes a drawer on small screens", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
