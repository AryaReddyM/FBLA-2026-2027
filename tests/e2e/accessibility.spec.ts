import { expect, test } from "@playwright/test"

import { expectNoA11yViolations, storageFor, waitForContent } from "./helpers"

test.describe("public pages", () => {
  for (const path of ["/login", "/signup", "/forgot-password", "/about"]) {
    test(`axe: ${path}`, async ({ page }) => {
      await page.goto(path)
      await expectNoA11yViolations(page)
    })
  }
})

test.describe("signed-in pages (admin)", () => {
  test.use({ storageState: storageFor("admin") })

  const PAGES = [
    "/",
    "/inventory",
    "/inventory/new",
    "/circulation",
    "/licenses",
    "/reports",
    "/audit",
    "/settings",
    "/settings/categories",
    "/settings/locations",
    "/settings/users",
    "/settings/import",
    "/help",
    "/profile",
  ]

  for (const path of PAGES) {
    test(`axe: ${path}`, async ({ page }) => {
      await page.goto(path)
      await waitForContent(page)
      await expectNoA11yViolations(page)
    })
  }

  test("axe: item detail page", async ({ page }) => {
    await page.goto("/inventory")
    await waitForContent(page)
    await page.locator("table a[href^='/inventory/']").first().click()
    await waitForContent(page)
    await expectNoA11yViolations(page)
  })

  test("axe: high contrast and dark mode, 150% text", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Accessibility" }).click()
    const panel = page.getByRole("dialog", { name: "Display preferences" })
    await panel.getByText("Largest", { exact: true }).click()
    await panel.getByText("High contrast", { exact: true }).click()
    await panel.getByText("Dark", { exact: true }).click()
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "150")
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high")
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.keyboard.press("Escape")
    await waitForContent(page)
    await expectNoA11yViolations(page)
  })

  test("axe: color-safe contrast with reduced motion, and preferences survive a reload", async ({ page }) => {
    await page.goto("/inventory")
    await page.getByRole("button", { name: "Accessibility" }).click()
    const panel = page.getByRole("dialog", { name: "Display preferences" })
    await panel.getByText("Color-safe contrast", { exact: true }).click()
    // The radio itself is announced and checked for screen reader users.
    await expect(panel.getByRole("radio", { name: /Color-safe contrast/ })).toBeChecked()
    await panel.getByRole("checkbox", { name: /Reduce motion/ }).check()
    await page.keyboard.press("Escape")
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "colorsafe")
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce")
    await waitForContent(page)
    await expectNoA11yViolations(page)

    // Reset puts everything back to the defaults.
    await page.getByRole("button", { name: "Accessibility" }).click()
    await page.getByRole("button", { name: "Reset preferences" }).click()
    await expect(page.locator("html")).not.toHaveAttribute("data-contrast", /.+/)
  })

  test("axe: every reading aid on (Lexend font, wide spacing, underlined links, strong focus, reading guide)", async ({ page }) => {
    await page.goto("/inventory")
    await page.getByRole("button", { name: "Accessibility" }).click()
    const panel = page.getByRole("dialog", { name: "Display preferences" })
    await panel.getByText("Easy reading", { exact: true }).click()
    for (const label of ["Wider text spacing", "Underline all links", "Stronger focus outline", "Reading guide"]) {
      await panel.getByRole("checkbox", { name: new RegExp(label) }).check()
    }
    const html = page.locator("html")
    await expect(html).toHaveAttribute("data-font", "lexend")
    await expect(html).toHaveAttribute("data-spacing", "wide")
    await expect(html).toHaveAttribute("data-links", "underline")
    await expect(html).toHaveAttribute("data-focus", "strong")
    await page.keyboard.press("Escape")
    await page.mouse.move(400, 500)
    await waitForContent(page)
    await expectNoA11yViolations(page)
    // The page must still fit the window with the extra spacing (WCAG 1.4.12).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("keyboard shortcuts, and read aloud start/stop", async ({ page }) => {
    await page.goto("/")
    await waitForContent(page)

    // Alt+A opens and closes the Display preferences panel.
    await page.keyboard.press("Alt+KeyA")
    const panel = page.getByRole("dialog", { name: "Display preferences" })
    await expect(panel).toBeVisible()

    // Read aloud uses the browser's own speech engine.
    await panel.getByRole("button", { name: "Read this page aloud" }).click()
    // A Stop button appears in the panel and as a floating button by the Accessibility button.
    await expect(page.getByRole("button", { name: "Stop reading" })).toHaveCount(2)
    await panel.getByRole("button", { name: "Stop reading" }).click()
    await expect(page.getByRole("button", { name: "Stop reading" })).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(panel).toHaveCount(0)

    // "?" lists the shortcuts.
    await page.locator("body").press("?")
    const shortcuts = page.getByRole("dialog", { name: "Keyboard shortcuts" })
    await expect(shortcuts).toBeVisible()
    await expectNoA11yViolations(page)
    await page.keyboard.press("Escape")
    await expect(shortcuts).toHaveCount(0)
  })
})
