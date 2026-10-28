import { describe, expect, it } from "vitest"

import { generateDemoData } from "@/lib/demo/generate"

const users = {
  admin: "00000000-0000-4000-8000-000000000001",
  manager: "00000000-0000-4000-8000-000000000002",
  staff: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
}
const now = new Date("2026-10-25T15:00:00Z")
const data = generateDemoData(users, now)

// These are the rules the database enforces. If the generator broke one, the
// seed would fail on the real database, so we catch it here first.
describe("demo data", () => {
  it("has roughly the size CLAUDE.md asks for", () => {
    expect(data.assets.length).toBeGreaterThanOrEqual(280)
    expect(data.assets.length).toBeLessThanOrEqual(330)
    expect(data.locations.length).toBeGreaterThanOrEqual(10)
    expect(data.locations.length).toBeLessThanOrEqual(15)
    const physicalLoans = data.checkouts.filter((c) => c.due_at !== null)
    expect(physicalLoans.length).toBeGreaterThanOrEqual(130)
  })

  it("is the same every time (reproducible demo)", () => {
    expect(generateDemoData(users, now).assets.map((a) => a.asset_tag)).toEqual(data.assets.map((a) => a.asset_tag))
  })

  it("has unique tags and serial numbers", () => {
    const tags = data.assets.map((a) => a.asset_tag)
    expect(new Set(tags).size).toBe(tags.length)
    const serials = data.assets.map((a) => a.serial_number).filter(Boolean)
    expect(new Set(serials).size).toBe(serials.length)
  })

  it("never has two open loans for the same physical item", () => {
    const kindOf = new Map(data.assets.map((a) => [a.id, a.kind]))
    const open = data.checkouts.filter((c) => c.returned_at === null && kindOf.get(c.asset_id as string) === "physical")
    const ids = open.map((c) => c.asset_id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("never assigns more seats than were purchased", () => {
    for (const license of data.licenses) {
      const used = data.checkouts.filter((c) => c.asset_id === license.asset_id && c.returned_at === null).length
      if (license.seats_total !== null) expect(used).toBeLessThanOrEqual(license.seats_total as number)
    }
  })

  it("includes overdue loans, damaged returns and upcoming renewals", () => {
    const overdue = data.checkouts.filter((c) => c.returned_at === null && c.due_at && new Date(c.due_at as string) < now)
    expect(overdue.length).toBeGreaterThan(0)
    expect(data.checkouts.some((c) => c.condition_in === "broken" || c.condition_in === "poor")).toBe(true)
    const soon = data.licenses.filter((l) => {
      const days = (new Date(l.renewal_date as string).getTime() - now.getTime()) / 86_400_000
      return days >= 0 && days <= 30
    })
    expect(soon.length).toBeGreaterThan(0)
  })

  it("uses only fictional, minimal student data", () => {
    for (const c of data.checkouts.filter((c) => c.borrower_type === "student")) {
      expect(c.borrower_ref).toMatch(/^\d{5}$/) // school ID only
      expect(Object.keys(c)).not.toContain("birthdate")
    }
  })

  it("never stores full license keys", () => {
    for (const l of data.licenses) if (l.license_key_hint) expect(String(l.license_key_hint).length).toBeLessThanOrEqual(4)
  })
})
