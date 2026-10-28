import { type NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { can } from "@/lib/permissions"
import { buildReport } from "@/lib/reports/build"
import {
  REPORT_FORMATS,
  REPORT_META,
  reportFileName,
  reportParamsSchema,
  type ReportFormat,
} from "@/lib/reports/definitions"
import { renderCsv } from "@/lib/reports/render-csv"
import { renderPdf } from "@/lib/reports/render-pdf"
import { renderXlsx } from "@/lib/reports/render-xlsx"
import { createClient } from "@/lib/supabase/server"

// Note: CLAUDE.md asks for `export const runtime = "nodejs"`. With Cache
// Components enabled Next.js rejects that export, and route handlers already
// run on Node.js by default, which @react-pdf/renderer and exceljs need.

const CONTENT_TYPES: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
}

/**
 * GET /api/reports/annual_inventory?format=pdf&location_id=…
 * Builds the report, saves a copy to Storage + report_runs (so it can be
 * re-downloaded from Report history), and returns the file.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/[type]">) {
  const user = await getCurrentUser()
  const { type } = await ctx.params
  const search = request.nextUrl.searchParams
  const format = search.get("format") as ReportFormat
  if (!REPORT_FORMATS.includes(format)) return NextResponse.json({ error: "Choose PDF, XLSX or CSV." }, { status: 400 })

  const parsed = reportParamsSchema.safeParse({
    type,
    location_id: search.get("location_id") || undefined,
    from: search.get("from") || undefined,
    to: search.get("to") || undefined,
  })
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid report." }, { status: 400 })
  if (!can(user.role, REPORT_META[parsed.data.type].permission)) {
    return NextResponse.json({ error: "Your role can't run this report." }, { status: 403 })
  }

  const supabase = await createClient()
  const started = performance.now()
  const data = await buildReport(supabase, user, parsed.data)
  const body =
    format === "pdf"
      ? await renderPdf(data)
      : format === "xlsx"
        ? await renderXlsx(data)
        : Buffer.from(renderCsv(data), "utf8")
  // Includes rendering the file, i.e. the full "generate a report" time.
  const durationMs = Math.round(performance.now() - started)
  const fileName = reportFileName(data, format)

  // Archive the file under reports/<user id>/… (storage policies check that folder).
  const path = `${user.id}/${Date.now()}-${fileName}`
  const { error: uploadError } = await supabase.storage
    .from("reports")
    .upload(path, body, { contentType: CONTENT_TYPES[format], upsert: false })

  await supabase.from("report_runs").insert({
    report_type: parsed.data.type,
    params: {
      location_id: parsed.data.location_id ?? null,
      from: parsed.data.from ?? null,
      to: parsed.data.to ?? null,
      scope: data.scope,
      period: data.period,
    },
    format,
    file_path: uploadError ? null : path,
    generated_by: user.id,
    row_count: data.rowCount,
    duration_ms: durationMs,
  })
  await supabase.from("metric_events").insert({ kind: "report", duration_ms: durationMs })

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Generation-Ms": String(durationMs),
    },
  })
}
