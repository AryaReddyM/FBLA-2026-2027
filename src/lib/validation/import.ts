// CSV import rules, shared by the browser (instant preview) and the server
// (the final check before anything is written).

import { CONDITION_LABELS, STATUS_LABELS } from "@/lib/labels"
import type { Enums } from "@/types/database"

export const IMPORT_FIELDS = [
  { key: "name", label: "Name", required: true, aliases: ["name", "item", "item name", "title", "description of item"] },
  { key: "kind", label: "Kind (physical/digital)", required: false, aliases: ["kind", "type", "asset type"] },
  { key: "asset_tag", label: "Asset tag", required: false, aliases: ["asset tag", "tag", "barcode", "asset id", "asset number"] },
  { key: "category", label: "Category", required: false, aliases: ["category", "category name", "group"] },
  { key: "location", label: "Location", required: false, aliases: ["location", "room", "area", "inventory area"] },
  { key: "status", label: "Status", required: false, aliases: ["status", "state"] },
  { key: "condition", label: "Condition", required: false, aliases: ["condition"] },
  { key: "serial_number", label: "Serial number", required: false, aliases: ["serial", "serial number", "serial no", "s/n", "sn"] },
  { key: "manufacturer", label: "Manufacturer", required: false, aliases: ["manufacturer", "brand", "make", "publisher"] },
  { key: "model", label: "Model", required: false, aliases: ["model", "model number"] },
  { key: "acquisition_date", label: "Acquired on", required: false, aliases: ["acquisition date", "acquired", "acquired on", "purchase date", "date purchased", "date acquired"] },
  { key: "acquisition_cost", label: "Cost", required: false, aliases: ["cost", "price", "acquisition cost", "purchase price", "value"] },
  { key: "funding_source", label: "Funding source", required: false, aliases: ["funding", "funding source", "fund", "source"] },
  { key: "vendor", label: "Vendor", required: false, aliases: ["vendor", "supplier"] },
  { key: "description", label: "Description", required: false, aliases: ["description", "details"] },
  { key: "notes", label: "Notes", required: false, aliases: ["notes", "comments", "remarks"] },
  { key: "seats_total", label: "Seats (digital)", required: false, aliases: ["seats", "licenses", "seat count", "seats total"] },
  { key: "renewal_date", label: "Renewal date (digital)", required: false, aliases: ["renewal", "renewal date", "renews"] },
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"]
export type ColumnMapping = Partial<Record<ImportField, number>>
export type RawImportRow = Partial<Record<ImportField, string>>

const norm = (s: string) => s.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ")

/** Matches spreadsheet headers like "Serial No" or "Room" to our fields. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const used = new Set<number>()
  for (const field of IMPORT_FIELDS) {
    const index = headers.findIndex((h, i) => !used.has(i) && (field.aliases as readonly string[]).includes(norm(h)))
    if (index >= 0) {
      mapping[field.key] = index
      used.add(index)
    }
  }
  return mapping
}

export function applyMapping(row: string[], mapping: ColumnMapping): RawImportRow {
  const out: RawImportRow = {}
  for (const field of IMPORT_FIELDS) {
    const index = mapping[field.key]
    if (index !== undefined) out[field.key] = (row[index] ?? "").trim()
  }
  return out
}

export type Lookups = {
  categories: { id: string; name: string; kind: Enums<"asset_kind"> }[]
  locations: { id: string; name: string }[]
}

export type ImportValue = {
  name: string
  kind: Enums<"asset_kind">
  asset_tag: string
  category_id: string | null
  location_id: string | null
  status: Enums<"asset_status">
  condition: Enums<"asset_condition"> | null
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  acquisition_date: string | null
  acquisition_cost: number | null
  funding_source: string | null
  vendor: string | null
  description: string | null
  notes: string | null
  seats_total: number | null
  renewal_date: string | null
}

/** Accepts 2026-08-15, 8/15/2026 or 8/15/26. Returns yyyy-mm-dd or null. */
export function parseFlexibleDate(input: string): string | null {
  const s = input.trim()
  let y: number, m: number, d: number
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s))) {
    ;[m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
    if (y < 100) y += 2000
  } else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function enumFrom<T extends string>(labels: Record<T, string>, input: string): T | null | undefined {
  const s = norm(input)
  if (!s) return null
  for (const [value, label] of Object.entries(labels) as [T, string][]) {
    if (norm(value) === s || norm(label) === s) return value
  }
  return undefined // present but unrecognized
}

const clip = (s: string | undefined, max: number) => {
  const v = (s ?? "").trim()
  return v ? v.slice(0, max) : null
}

/** Validates one mapped row. Returns the cleaned value, or a list of plain-English problems. */
export function validateImportRow(raw: RawImportRow, lookups: Lookups): { ok: true; value: ImportValue } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const name = (raw.name ?? "").trim()
  if (!name) errors.push("Name is missing.")
  if (name.length > 200) errors.push("Name is longer than 200 characters.")

  let category: Lookups["categories"][number] | undefined
  if (raw.category?.trim()) {
    category = lookups.categories.find((c) => norm(c.name) === norm(raw.category ?? ""))
    if (!category) errors.push(`Unknown category “${raw.category}”. Add it in Settings → Categories first.`)
  }

  const kindInput = norm(raw.kind ?? "")
  let kind: Enums<"asset_kind"> = category?.kind ?? "physical"
  if (kindInput) {
    if (["digital", "software", "license", "subscription", "ebook", "e-book"].includes(kindInput)) kind = "digital"
    else if (["physical", "hardware", "equipment", "device", "item"].includes(kindInput)) kind = "physical"
    else errors.push(`Kind “${raw.kind}” should be physical or digital.`)
  }
  if (category && category.kind !== kind) errors.push(`Category “${category.name}” is for ${category.kind} items.`)

  let locationId: string | null = null
  if (raw.location?.trim()) {
    const loc = lookups.locations.find((l) => norm(l.name) === norm(raw.location ?? ""))
    if (!loc) errors.push(`Unknown location “${raw.location}”. Add it in Settings → Locations first.`)
    else locationId = loc.id
  }

  const status = enumFrom(STATUS_LABELS, raw.status ?? "")
  if (status === undefined) errors.push(`Status “${raw.status}” isn't one of: Available, In repair, Retired, Lost.`)
  if (status === "checked_out") errors.push("Items can't be imported as checked out. Import them as Available, then check them out.")

  const condition = enumFrom(CONDITION_LABELS, raw.condition ?? "")
  if (condition === undefined) errors.push(`Condition “${raw.condition}” isn't one of: New, Good, Fair, Poor, Broken.`)

  const tag = (raw.asset_tag ?? "").trim().toUpperCase()
  if (tag && !/^[A-Z0-9-]{1,64}$/.test(tag)) errors.push(`Asset tag “${raw.asset_tag}” can only use letters, numbers and dashes.`)

  let acquisitionDate: string | null = null
  if (raw.acquisition_date?.trim()) {
    acquisitionDate = parseFlexibleDate(raw.acquisition_date)
    if (!acquisitionDate) errors.push(`“${raw.acquisition_date}” isn't a date. Use 2026-08-15 or 8/15/2026.`)
  }
  let renewalDate: string | null = null
  if (raw.renewal_date?.trim()) {
    renewalDate = parseFlexibleDate(raw.renewal_date)
    if (!renewalDate) errors.push(`Renewal date “${raw.renewal_date}” isn't a date.`)
  }

  let cost: number | null = null
  if (raw.acquisition_cost?.trim()) {
    cost = Number(raw.acquisition_cost.replace(/[$,\s]/g, ""))
    if (!Number.isFinite(cost) || cost < 0 || cost > 10_000_000) {
      errors.push(`Cost “${raw.acquisition_cost}” isn't a valid amount.`)
      cost = null
    }
  }
  let seats: number | null = null
  if (raw.seats_total?.trim()) {
    seats = Number(raw.seats_total.replace(/,/g, ""))
    if (!Number.isInteger(seats) || seats < 1) {
      errors.push(`Seats “${raw.seats_total}” must be a whole number above 0.`)
      seats = null
    }
  }

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      name,
      kind,
      asset_tag: tag,
      category_id: category?.id ?? null,
      location_id: kind === "physical" ? locationId : null,
      status: status ?? "available",
      condition: condition ?? null,
      serial_number: clip(raw.serial_number, 120),
      manufacturer: clip(raw.manufacturer, 120),
      model: clip(raw.model, 120),
      acquisition_date: acquisitionDate,
      acquisition_cost: cost,
      funding_source: clip(raw.funding_source, 80),
      vendor: clip(raw.vendor, 120),
      description: clip(raw.description, 2000),
      notes: clip(raw.notes, 2000),
      seats_total: kind === "digital" ? seats : null,
      renewal_date: kind === "digital" ? renewalDate : null,
    },
  }
}
