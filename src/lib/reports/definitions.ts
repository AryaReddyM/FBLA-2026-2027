// Report types and the shape every report is built into. One structure feeds
// the on-screen preview AND the PDF, Excel and CSV files, so they always match.

import { z } from "zod"

import type { Permission } from "@/lib/permissions"

export const REPORT_TYPES = ["annual_inventory", "checkout_activity", "valuation", "license_summary", "audit_trail"] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_FORMATS = ["pdf", "xlsx", "csv"] as const
export type ReportFormat = (typeof REPORT_FORMATS)[number]

export const REPORT_META: Record<
  ReportType,
  { title: string; description: string; permission: Permission; usesLocation: boolean; usesDates: boolean; landscape: boolean }
> = {
  annual_inventory: {
    title: "Annual Inventory Report",
    description: "Every item by location and category, with counts, condition and value totals.",
    permission: "reports.all",
    usesLocation: true,
    usesDates: false,
    landscape: true,
  },
  checkout_activity: {
    title: "Checkout Activity",
    description: "Loans in a date range, plus overdue and lost items.",
    permission: "reports.own",
    usesLocation: false,
    usesDates: true,
    landscape: true,
  },
  valuation: {
    title: "Asset Valuation & Depreciation",
    description: "Original cost, depreciation to date and current book value by category.",
    permission: "reports.all",
    usesLocation: true,
    usesDates: false,
    landscape: true,
  },
  license_summary: {
    title: "Digital License Summary",
    description: "Seats used vs. purchased, cost per used seat and upcoming renewals.",
    permission: "reports.all",
    usesLocation: false,
    usesDates: false,
    landscape: true,
  },
  audit_trail: {
    title: "Audit Trail Export",
    description: "Every recorded change in a date range: who did what, and when.",
    permission: "audit.view",
    usesLocation: false,
    usesDates: true,
    landscape: false,
  },
}

const dateString = z.iso.date()

export const reportParamsSchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    location_id: z.guid().optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { path: ["to"], error: "The end date must be after the start date." })

export type ReportParams = z.infer<typeof reportParamsSchema>

export type CellValue = string | number | null
export type ColumnFormat = "text" | "money" | "number" | "date" | "percent"

export type ReportColumn = {
  key: string
  label: string
  format?: ColumnFormat
  /** Relative width hint for PDF/XLSX (default 1). */
  width?: number
}

export type ReportRow = Record<string, CellValue>

export type ReportGroup = {
  title?: string
  rows: ReportRow[]
  /** Optional subtotal row (values keyed like the columns). */
  subtotal?: ReportRow
}

export type ReportSection = {
  title?: string
  groups: ReportGroup[]
  subtotal?: ReportRow
}

export type ReportData = {
  type: ReportType
  title: string
  institution: string
  /** "Fiscal year 2026–27" or a date range. */
  period: string
  /** "All locations" or a location name, etc. */
  scope: string
  generatedAt: string
  generatedBy: string
  columns: ReportColumn[]
  sections: ReportSection[]
  grandTotal?: ReportRow
  summary: { label: string; value: string }[]
  notes: string[]
  rowCount: number
}

export function reportFileName(data: Pick<ReportData, "type" | "generatedAt">, format: ReportFormat) {
  return `edutrack-${data.type.replaceAll("_", "-")}-${data.generatedAt.slice(0, 10)}.${format}`
}
