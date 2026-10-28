// Human-friendly labels for database enum values.

import type { Enums } from "@/types/database"

export const STATUS_LABELS: Record<Enums<"asset_status">, string> = {
  available: "Available",
  checked_out: "Checked out",
  in_repair: "In repair",
  retired: "Retired",
  lost: "Lost",
}

export const CONDITION_LABELS: Record<Enums<"asset_condition">, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  broken: "Broken",
}

export const KIND_LABELS: Record<Enums<"asset_kind">, string> = {
  physical: "Physical",
  digital: "Digital",
}

export const BORROWER_TYPE_LABELS: Record<Enums<"borrower_type">, string> = {
  student: "Student",
  staff: "Staff member",
  classroom: "Classroom",
}

export const LOCATION_TYPE_LABELS: Record<Enums<"location_type">, string> = {
  classroom: "Classroom",
  library: "Library",
  office: "Office",
  storage: "Storage",
  lab: "Lab",
  other: "Other",
}

export const LICENSE_TYPE_LABELS: Record<Enums<"license_type">, string> = {
  per_seat: "Per seat",
  site: "Site license",
  subscription: "Subscription",
}

export const BILLING_CYCLE_LABELS: Record<Enums<"billing_cycle">, string> = {
  monthly: "Monthly",
  annual: "Annual",
  multi_year: "Multi-year (3 yr)",
  one_time: "One-time",
}

export const FUNDING_SOURCES = [
  "General fund",
  "Title I",
  "Title IV-A",
  "ESSER",
  "E-Rate",
  "PTA",
  "Grant",
  "Donation",
] as const

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

/** Shown in lists and the activity feed: "Student #10234", never a student's name. */
export function borrowerLabel(type: Enums<"borrower_type">, name: string, ref: string | null): string {
  if (type === "student") return `Student #${ref || name}`
  return name
}

/** Yearly cost of a license, whatever its billing cycle (multi-year assumes 3 years). */
export function annualizedCost(cost: number | null, cycle: Enums<"billing_cycle">): number | null {
  if (cost == null) return null
  switch (cycle) {
    case "monthly":
      return cost * 12
    case "multi_year":
      return cost / 3
    default:
      return cost
  }
}
