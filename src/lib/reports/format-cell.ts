import { formatDate, formatMoney, formatNumber } from "@/lib/format"

import type { CellValue, ColumnFormat } from "./definitions"

/** How a cell looks in the preview, PDF and CSV (Excel keeps real numbers and formats them itself). */
export function formatCell(value: CellValue | undefined, format: ColumnFormat = "text"): string {
  if (value === null || value === undefined || value === "") return ""
  switch (format) {
    case "money":
      return typeof value === "number" ? formatMoney(value) : String(value)
    case "number":
      return typeof value === "number" ? formatNumber(value) : String(value)
    case "percent":
      return typeof value === "number" ? `${Math.round(value * 100)}%` : String(value)
    case "date":
      return typeof value === "string" ? formatDate(value, value) : String(value)
    default:
      return String(value)
  }
}

export const isNumeric = (format?: ColumnFormat) => format === "money" || format === "number" || format === "percent"
