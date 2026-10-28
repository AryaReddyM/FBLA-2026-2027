import "server-only"

import ExcelJS from "exceljs"

import { formatDateTime } from "@/lib/format"

import type { ReportColumn, ReportData, ReportRow } from "./definitions"

const NUM_FMT: Partial<Record<NonNullable<ReportColumn["format"]>, string>> = {
  money: '"$"#,##0.00',
  number: "#,##0",
  percent: "0%",
  date: "mmm d, yyyy",
}

function cellValue(row: ReportRow, col: ReportColumn): ExcelJS.CellValue {
  const v = row[col.key]
  if (v === null || v === undefined) return null
  if (col.format === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }
  return v
}

/** A formatted Excel workbook: title block, grouped tables, bold subtotals, real number formats. */
export async function renderXlsx(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "EduTrack"
  wb.created = new Date(data.generatedAt)

  const ws = wb.addWorksheet(data.title.slice(0, 31), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 6 }],
  })
  const n = data.columns.length

  ws.columns = data.columns.map((c) => ({ key: c.key, width: Math.round(14 * (c.width ?? 1)) }))

  const title = ws.addRow([data.title])
  title.font = { size: 16, bold: true }
  ws.mergeCells(title.number, 1, title.number, n)
  ws.addRow([data.institution]).font = { size: 12 }
  ws.addRow([`${data.period} · ${data.scope}`]).font = { color: { argb: "FF555555" } }
  ws.addRow([`Generated ${formatDateTime(data.generatedAt)} by ${data.generatedBy}`]).font = { color: { argb: "FF555555" } }
  ws.addRow([])

  const header = ws.addRow(data.columns.map((c) => c.label))
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F4FB8" } }
    cell.alignment = { vertical: "middle" }
  })

  const addDataRow = (row: ReportRow, style?: "subtotal" | "total") => {
    const r = ws.addRow(data.columns.map((c) => cellValue(row, c)))
    data.columns.forEach((c, i) => {
      const fmt = c.format ? NUM_FMT[c.format] : undefined
      if (fmt) r.getCell(i + 1).numFmt = fmt
    })
    if (style) {
      r.font = { bold: true }
      r.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style === "total" ? "FFDCE3F7" : "FFF1F3F9" } }
        cell.border = { top: { style: "thin", color: { argb: "FF9AA5C4" } } }
      })
    }
  }

  const label = (text: string, size = 12) => {
    const r = ws.addRow([text])
    r.font = { bold: true, size }
    ws.mergeCells(r.number, 1, r.number, n)
  }

  for (const section of data.sections) {
    if (section.title) label(section.title, 13)
    for (const group of section.groups) {
      if (group.title) label(`  ${group.title}`, 11)
      for (const row of group.rows) addDataRow(row)
      if (group.subtotal) addDataRow(group.subtotal, "subtotal")
    }
    if (section.subtotal) addDataRow(section.subtotal, "total")
  }
  if (data.grandTotal) {
    ws.addRow([])
    addDataRow(data.grandTotal, "total")
  }

  // Summary and notes on their own sheet, so the main sheet stays a clean table.
  const summary = wb.addWorksheet("Summary")
  summary.columns = [{ width: 34 }, { width: 22 }]
  summary.addRow([data.title]).font = { bold: true, size: 14 }
  summary.addRow([])
  for (const s of data.summary) summary.addRow([s.label, s.value])
  summary.addRow([])
  for (const note of data.notes) summary.addRow([note]).font = { italic: true, color: { argb: "FF555555" } }

  return Buffer.from(await wb.xlsx.writeBuffer())
}
