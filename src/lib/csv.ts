// Tiny CSV reader/writer (RFC 4180). Small enough that a library isn't worth it.

type Cell = string | number | boolean | null | undefined

/**
 * Spreadsheet apps run cells starting with = + - @ as formulas, so an item
 * named "=HYPERLINK(...)" could do something nasty when a report is opened.
 * Prefixing a quote makes Excel show it as text ("CSV injection").
 */
function protect(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function toCsvCell(value: Cell): string {
  if (value === null || value === undefined) return ""
  const str = typeof value === "string" ? protect(value) : String(value)
  return /[",\r\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(toCsvCell).join(","))
  // BOM so Excel opens UTF-8 (accents, "—") correctly.
  return "﻿" + lines.join("\r\n") + "\r\n"
}

/** Parses CSV text into rows of strings. Handles quotes, escaped quotes and newlines in cells. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell === "") inQuotes = true
    else if (ch === ",") {
      row.push(cell)
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += ch
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  // Drop completely empty lines (common at the end of exported files).
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}
