import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns"

type DateInput = string | Date | null | undefined

function toDate(value: DateInput): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  // Plain dates ("2026-10-25") are parsed as local dates so they don't shift a day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Oct 25, 2026" (the house style from CLAUDE.md §14). */
export function formatDate(value: DateInput, fallback = "—"): string {
  const d = toDate(value)
  return d ? format(d, "MMM d, yyyy") : fallback
}

/** "Oct 25, 2026, 2:05 PM" */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value)
  return d ? format(d, "MMM d, yyyy, h:mm a") : fallback
}

/** "3 days ago" */
export function formatRelative(value: DateInput, fallback = "—"): string {
  const d = toDate(value)
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : fallback
}

/** Whole days from today until a date (negative = in the past). */
export function daysUntil(value: DateInput, today = new Date()): number | null {
  const d = toDate(value)
  return d ? differenceInCalendarDays(d, today) : null
}

/** yyyy-mm-dd for <input type="date">. */
export function toDateInputValue(value: DateInput): string {
  const d = toDate(value)
  return d ? format(d, "yyyy-MM-dd") : ""
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})
const plain = new Intl.NumberFormat("en-US")

export function formatMoney(value: number | string | null | undefined, opts?: { whole?: boolean }): string {
  if (value === null || value === undefined || value === "") return "—"
  const n = typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(n)) return "—"
  return (opts?.whole ? usdWhole : usd).format(n)
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : plain.format(value)
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${plain.format(count)} ${count === 1 ? singular : plural}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes} min ${seconds} s`
}

/** "Morgan Lee" → "ML" for avatars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}
