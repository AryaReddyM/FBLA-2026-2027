import { toCsv } from "@/lib/csv"

import type { ReportData } from "./definitions"
import { formatCell } from "./format-cell"

/** CSV is for re-using the data, so it's one flat table with the grouping as extra columns. */
export function renderCsv(data: ReportData): string {
  const hasSections = data.sections.some((s) => s.title)
  const hasGroups = data.sections.some((s) => s.groups.some((g) => g.title))
  const headers = [
    ...(hasSections ? ["Section"] : []),
    ...(hasGroups ? ["Group"] : []),
    ...data.columns.map((c) => c.label),
  ]
  const rows: (string | number | null)[][] = []
  for (const section of data.sections) {
    for (const group of section.groups) {
      for (const row of group.rows) {
        rows.push([
          ...(hasSections ? [section.title ?? ""] : []),
          ...(hasGroups ? [group.title ?? ""] : []),
          // Numbers stay raw (no "$" or commas) so spreadsheets can add them up.
          ...data.columns.map((c) => {
            const v = row[c.key]
            if (typeof v === "number") return c.format === "percent" ? Math.round(v * 1000) / 10 : v
            return c.format === "date" ? formatCell(v, "date") : (v ?? "")
          }),
        ])
      }
    }
  }
  return toCsv(headers, rows)
}
