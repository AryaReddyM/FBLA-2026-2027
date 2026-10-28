import { expect, test } from "@playwright/test"

import { storageFor, waitForContent } from "./helpers"

test.describe("signing in and out", () => {
  test("wrong password shows a friendly error", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#field-email").first().fill("nobody@edutrack-tests.example")
    await page.locator("input#field-password").fill("definitely-wrong")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible()
  })

  test("signed-out visitors are sent to sign in", async ({ page }) => {
    await page.goto("/inventory")
    await expect(page).toHaveURL(/\/login\?next=%2Finventory/)
  })

  test.describe("as staff", () => {
    test.use({ storageState: storageFor("staff") })
    test("sees the desk but not admin tools, and can sign out", async ({ page }) => {
      await page.goto("/")
      const nav = page.getByRole("navigation", { name: "Main navigation" })
      await expect(nav.getByRole("link", { name: "Circulation" })).toBeVisible()
      // Staff don't get the Admin menu or the Activity log.
      await expect(nav.getByRole("button", { name: /Admin/ })).toHaveCount(0)
      await expect(nav.getByRole("link", { name: "Activity" })).toHaveCount(0)
      // Staff can add items (owner decision, Oct 2026) and see the annual summary of their own loans.
      await expect(page.getByRole("link", { name: "Add inventory" }).first()).toBeVisible()
      await expect(page.getByRole("link", { name: "View annual summary" }).first()).toHaveAttribute("href", /checkout_activity/)

      await page.goto("/settings/users")
      await expect(page).toHaveURL(/denied=1/)

      await page.getByRole("button", { name: /Account menu/ }).click()
      await page.getByRole("menuitem", { name: "Sign out" }).click()
      await expect(page).toHaveURL(/\/login/)
    })
  })
})

test.describe("staff adding items", () => {
  test.use({ storageState: storageFor("staff") })
  test("a teacher adds an item and can edit it, but can't retire it", async ({ page }) => {
    const name = `E2E Staff Document Camera ${Date.now()}`
    await page.goto("/inventory/new")
    await page.locator("#field-name").fill(name)
    // Staff only get Available / In repair as starting statuses.
    await page.locator("#field-status").click()
    await expect(page.getByRole("option", { name: "Retired" })).toHaveCount(0)
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Register item" }).click()
    await expect(page.getByRole("heading", { name })).toBeVisible()
    await expect(page.getByRole("link", { name: "Edit" })).toBeVisible()
    await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(0)
  })
})

test.describe("inventory and circulation (manager)", () => {
  test.use({ storageState: storageFor("manager") })

  test("register an item, find it, check it out and back in", async ({ page }) => {
    const name = `E2E Test Projector ${Date.now()}`
    const serial = `E2E${Date.now()}`

    // Register
    await page.goto("/inventory/new")
    await page.locator("#field-name").fill(name)
    await page.locator("#field-serial_number").fill(serial)
    await page.locator("#field-acquisition_cost").fill("499.00")
    await page.getByRole("button", { name: "Register item" }).click()
    await expect(page.getByRole("heading", { name })).toBeVisible()
    const tag = (await page.locator("p.font-mono").first().textContent())?.trim() ?? ""
    expect(tag).toMatch(/^[A-Z0-9]+-\d{4}-\d{6}$/)

    // Duplicate detection on the same serial number
    await page.goto("/inventory/new")
    await page.locator("#field-name").fill(`${name} copy`)
    await page.locator("#field-serial_number").fill(serial)
    await page.getByRole("button", { name: "Register item" }).click()
    await expect(page.getByText("Possible duplicate")).toBeVisible()

    // Search
    await page.goto(`/inventory?q=${encodeURIComponent(serial)}`)
    await waitForContent(page)
    await expect(page.getByRole("link", { name }).first()).toBeVisible()

    // Check out at the desk
    await page.goto("/circulation")
    await page.getByLabel("Scan or type an asset tag").fill(tag)
    await page.getByRole("button", { name: "Look up" }).click()
    await page.locator("#field-borrower_name").fill("E2E Student")
    await page.locator("#field-borrower_ref").fill("19999")
    await page.getByRole("button", { name: "Check out", exact: true }).last().click()
    await expect(page.getByText(`${name} (${tag}) checked out.`)).toBeVisible()

    // Scanning it again switches the desk to Check in; forcing Check out is refused
    await page.getByLabel("Scan or type an asset tag").fill(tag)
    await page.getByRole("button", { name: "Look up" }).click()
    await expect(page.getByRole("radio", { name: "Check in" })).toHaveAttribute("aria-checked", "true")
    await page.getByRole("radio", { name: "Check out" }).click()
    await expect(page.getByText(/already checked out/)).toBeVisible()

    // Check in as broken → goes to repair
    await page.getByRole("button", { name: "Check it in instead" }).click()
    await page.getByRole("radio", { name: "Broken" }).click()
    await page.getByRole("button", { name: "Check in", exact: true }).last().click()
    await expect(page.getByText(`${name} (${tag}) checked in.`)).toBeVisible()
  })

  test("generate the annual report as CSV", async ({ page }) => {
    await page.goto("/reports?type=annual_inventory")
    await waitForContent(page)
    await expect(page.getByText(/Built in/)).toBeVisible()
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "CSV" }).click()
    expect((await download).suggestedFilename()).toMatch(/annual-inventory.*\.csv$/)
    await expect(page.getByText("Report history")).toBeVisible()
  })
})

test.describe("viewer is read-only", () => {
  test.use({ storageState: storageFor("viewer") })
  test("can browse the catalog but not change anything", async ({ page }) => {
    await page.goto("/inventory")
    await waitForContent(page)
    await expect(page.getByRole("link", { name: "Add inventory" })).toHaveCount(0)
    await expect(page.getByRole("checkbox")).toHaveCount(0)
    await page.goto("/circulation")
    await expect(page).toHaveURL(/denied=1/)
  })
})
