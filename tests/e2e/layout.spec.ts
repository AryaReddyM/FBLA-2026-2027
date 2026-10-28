import { expect, test } from "@playwright/test"

import { storageFor, waitForContent } from "./helpers"

test.use({ storageState: storageFor("admin") })

// The top bar holds a lot (8 links, search, account). Make sure it never
// pushes the page wider than the window at common laptop/monitor widths.
for (const width of [1024, 1280, 1440, 1920]) {
  test(`no sideways scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ["/", "/inventory", "/reports"]) {
      await page.goto(path)
      await waitForContent(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1)
    }
  })
}

test("hero search goes to the filtered catalog", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("searchbox", { name: /Search by name/ }).fill("Chromebook")
  await page.getByLabel("Format").selectOption("physical")
  await page.getByRole("button", { name: "Search catalog" }).click()
  await expect(page).toHaveURL(/\/inventory\?q=Chromebook&kind=physical/)
  await waitForContent(page)
  await expect(page.getByRole("heading", { name: "Browse the catalog" })).toBeVisible()
  await expect(page.locator("table").getByText(/Chromebook/).first()).toBeVisible()
})
