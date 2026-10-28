import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

import type { TestRole } from "../support/test-accounts"

export const storageFor = (role: TestRole) => `tests/e2e/.auth/${role}.json`

/** Fails the test on any serious or critical WCAG 2.x A/AA violation. */
export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Recharts draws decorative SVG internals; the chart's text alternative and table view carry the data.
    .exclude(".recharts-surface")
    .analyze()
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
  const report = serious.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join("\n  ")}`)
  expect(report, report.join("\n\n")).toEqual([])
}

/** Wait for streamed (Suspense) content: no skeletons marked aria-busy left. */
export async function waitForContent(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}
