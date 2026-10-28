import { describe, expect, it } from "vitest"

import { monthsBetween, straightLineDepreciation } from "@/lib/depreciation"

describe("straight-line depreciation", () => {
  it("loses the same amount every year", () => {
    // $300 Chromebook, 4-year life, exactly 2 years old → half its value left.
    const r = straightLineDepreciation({
      cost: 300,
      acquisitionDate: "2024-08-15",
      usefulLifeYears: 4,
      asOf: new Date(2026, 7, 15),
    })
    expect(r).not.toBeNull()
    expect(r!.annualDepreciation).toBe(75)
    expect(r!.accumulatedDepreciation).toBe(150)
    expect(r!.bookValue).toBe(150)
    expect(r!.fullyDepreciated).toBe(false)
  })

  it("counts whole months, so value drops smoothly through the year", () => {
    const r = straightLineDepreciation({
      cost: 1200,
      acquisitionDate: "2026-01-10",
      usefulLifeYears: 10,
      asOf: new Date(2026, 6, 10), // 6 months later
    })
    expect(r!.monthsElapsed).toBe(6)
    expect(r!.accumulatedDepreciation).toBe(60)
    expect(r!.bookValue).toBe(1140)
  })

  it("never goes below zero (or below salvage value)", () => {
    const r = straightLineDepreciation({ cost: 500, acquisitionDate: "2010-01-01", usefulLifeYears: 5, asOf: new Date(2026, 0, 1) })
    expect(r!.bookValue).toBe(0)
    expect(r!.fullyDepreciated).toBe(true)

    const s = straightLineDepreciation({ cost: 500, acquisitionDate: "2010-01-01", usefulLifeYears: 5, salvageValue: 50, asOf: new Date(2026, 0, 1) })
    expect(s!.bookValue).toBe(50)
  })

  it("keeps full value before the acquisition date", () => {
    const r = straightLineDepreciation({ cost: 100, acquisitionDate: "2027-01-01", usefulLifeYears: 4, asOf: new Date(2026, 0, 1) })
    expect(r!.bookValue).toBe(100)
  })

  it("returns null when information is missing", () => {
    expect(straightLineDepreciation({ cost: null, acquisitionDate: "2024-01-01", usefulLifeYears: 4 })).toBeNull()
    expect(straightLineDepreciation({ cost: 100, acquisitionDate: null, usefulLifeYears: 4 })).toBeNull()
    expect(straightLineDepreciation({ cost: 100, acquisitionDate: "2024-01-01", usefulLifeYears: null })).toBeNull()
  })

  it("monthsBetween only counts completed months", () => {
    expect(monthsBetween(new Date(2026, 0, 31), new Date(2026, 1, 28))).toBe(0)
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 1, 15))).toBe(1)
    expect(monthsBetween(new Date(2026, 5, 1), new Date(2026, 0, 1))).toBe(0)
  })
})
