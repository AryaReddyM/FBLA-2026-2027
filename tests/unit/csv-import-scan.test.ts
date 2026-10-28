import { describe, expect, it } from "vitest"

import { parseCsv, toCsv, toCsvCell } from "@/lib/csv"
import { parseScannedCode } from "@/lib/scan"
import { applyMapping, guessMapping, parseFlexibleDate, validateImportRow, type Lookups } from "@/lib/validation/import"

describe("CSV", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsvCell('Desk, "large"')).toBe('"Desk, ""large"""')
    expect(toCsvCell("line\nbreak")).toBe('"line\nbreak"')
  })

  it("defuses spreadsheet formulas (CSV injection)", () => {
    expect(toCsvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"")
    expect(toCsvCell("+1")).toBe("'+1")
    expect(toCsvCell(-5)).toBe("-5") // real numbers are untouched
  })

  it("round-trips through the parser", () => {
    const csv = toCsv(["Name", "Notes"], [["Chromebook", 'Has "sticker", cracked'], ["Desk", "multi\nline"]])
    expect(parseCsv(csv)).toEqual([
      ["Name", "Notes"],
      ["Chromebook", 'Has "sticker", cracked'],
      ["Desk", "multi\nline"],
    ])
  })

  it("ignores blank lines and Windows line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })
})

describe("CSV import", () => {
  const lookups: Lookups = {
    categories: [
      { id: "c1", name: "Chromebooks", kind: "physical" },
      { id: "c2", name: "Learning subscriptions", kind: "digital" },
    ],
    locations: [{ id: "l1", name: "Room 204" }],
  }

  it("guesses columns from common header names", () => {
    const m = guessMapping(["Item Name", "Serial No", "Room", "Purchase Price", "Date Purchased"])
    expect(m).toMatchObject({ name: 0, serial_number: 1, location: 2, acquisition_cost: 3, acquisition_date: 4 })
  })

  it("accepts US and ISO dates, rejects impossible ones", () => {
    expect(parseFlexibleDate("8/15/2026")).toBe("2026-08-15")
    expect(parseFlexibleDate("2026-08-15")).toBe("2026-08-15")
    expect(parseFlexibleDate("2/30/2026")).toBeNull()
    expect(parseFlexibleDate("someday")).toBeNull()
  })

  it("resolves category and location names case-insensitively", () => {
    const raw = applyMapping(["chromebook 314", "chromebooks", "room 204", "$289.00", "available"], { name: 0, category: 1, location: 2, acquisition_cost: 3, status: 4 })
    const r = validateImportRow(raw, lookups)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ category_id: "c1", location_id: "l1", acquisition_cost: 289, status: "available", kind: "physical" })
  })

  it("explains every problem in plain English", () => {
    const r = validateImportRow({ name: "", category: "Robots", status: "checked out", acquisition_date: "soon" }, lookups)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.join(" ")).toMatch(/Name is missing/)
      expect(r.errors.join(" ")).toMatch(/Unknown category/)
      expect(r.errors.join(" ")).toMatch(/can't be imported as checked out/)
      expect(r.errors.join(" ")).toMatch(/isn't a date/)
    }
  })

  it("infers digital kind from the category", () => {
    const r = validateImportRow({ name: "Quizlet Plus", category: "Learning subscriptions", seats_total: "30" }, lookups)
    expect(r.ok && r.value.kind).toBe("digital")
    expect(r.ok && r.value.seats_total).toBe(30)
  })
})

describe("scanning", () => {
  it("reads tags from EduTrack label links", () => {
    expect(parseScannedCode("https://edutrack.example/t/EDU-2026-000412")).toEqual({ type: "tag", value: "EDU-2026-000412" })
  })
  it("reads item ids from item page links", () => {
    expect(parseScannedCode("https://x.example/inventory/3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e")).toEqual({
      type: "id",
      value: "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e",
    })
  })
  it("treats plain barcodes as tags", () => {
    expect(parseScannedCode("  lhs-0042 ")).toEqual({ type: "tag", value: "LHS-0042" })
    expect(parseScannedCode("")).toBeNull()
  })
})
