// Straight-line depreciation: an item loses the same amount of value every
// year of its useful life. A $300 Chromebook with a 4-year life loses $75 a
// year; after 2 years it is "worth" $150 on the books. Schools use this for
// annual inventory reports and insurance.
//
// We count whole elapsed months so value drops smoothly through the year
// instead of all at once on the purchase anniversary.

export type DepreciationInput = {
  cost: number | null | undefined
  acquisitionDate: string | Date | null | undefined
  usefulLifeYears: number | null | undefined
  /** Value left at the end of the useful life. Schools usually use 0. */
  salvageValue?: number
  asOf?: Date
}

export type DepreciationResult = {
  cost: number
  annualDepreciation: number
  accumulatedDepreciation: number
  bookValue: number
  monthsElapsed: number
  /** 0 to 1: how much of the useful life has been used. */
  lifeUsed: number
  fullyDepreciated: boolean
}

function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value
  const [y, m, d] = value.slice(0, 10).split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Whole calendar months from start to end (0 if end is before start). */
export function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Returns null when there isn't enough information (no cost, date or useful life). */
export function straightLineDepreciation(input: DepreciationInput): DepreciationResult | null {
  const { cost, acquisitionDate, usefulLifeYears } = input
  if (cost == null || !Number.isFinite(cost) || cost < 0) return null
  if (!acquisitionDate || !usefulLifeYears || usefulLifeYears <= 0) return null

  const salvage = Math.min(Math.max(input.salvageValue ?? 0, 0), cost)
  const depreciable = cost - salvage
  const lifeMonths = usefulLifeYears * 12
  const monthsElapsed = monthsBetween(parseDate(acquisitionDate), input.asOf ?? new Date())
  const lifeUsed = Math.min(monthsElapsed / lifeMonths, 1)
  const accumulated = round2(depreciable * lifeUsed)

  return {
    cost: round2(cost),
    annualDepreciation: round2(depreciable / usefulLifeYears),
    accumulatedDepreciation: accumulated,
    bookValue: round2(cost - accumulated),
    monthsElapsed,
    lifeUsed,
    fullyDepreciated: lifeUsed >= 1,
  }
}
