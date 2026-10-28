import { Timer } from "lucide-react"
import { Fragment } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format"
import type { ReportData, ReportRow } from "@/lib/reports/definitions"
import { formatCell, isNumeric } from "@/lib/reports/format-cell"
import { cn } from "@/lib/utils"

const PREVIEW_LIMIT = 300

/** The on-screen version of a report: same data the PDF/Excel/CSV files use. */
/** Trims sections/groups to the first PREVIEW_LIMIT rows, computed before rendering. */
function limitRows(data: ReportData) {
  let remaining = PREVIEW_LIMIT
  return data.sections.map((section) => ({
    ...section,
    groups: section.groups.map((group) => {
      const rows = group.rows.slice(0, Math.max(0, remaining))
      remaining -= rows.length
      return { ...group, rows, complete: rows.length === group.rows.length }
    }),
    complete: remaining > 0,
  }))
}

export function ReportPreview({ data, durationMs }: { data: ReportData; durationMs: number }) {
  const cols = data.columns
  const sections = limitRows(data)

  const renderRow = (row: ReportRow, key: string, kind?: "subtotal" | "total") => (
    <TableRow
      key={key}
      className={cn(kind === "subtotal" && "bg-muted/60 font-medium", kind === "total" && "bg-accent font-semibold")}
    >
      {cols.map((c) => (
        <TableCell
          key={c.key}
          className={cn(
            "text-sm",
            isNumeric(c.format) && "text-right tabular-nums",
            c.key === "asset_tag" && "font-mono text-xs",
          )}
        >
          {formatCell(row[c.key], c.format)}
        </TableCell>
      ))}
    </TableRow>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardDescription>{data.institution}</CardDescription>
            <CardTitle className="text-xl">{data.title}</CardTitle>
            <CardDescription>
              {data.period} · {data.scope} · prepared {formatDateTime(data.generatedAt)} for {data.generatedBy}
            </CardDescription>
          </div>
          {/* Generation time on screen (CLAUDE.md §8.7), to show the speed-up the paper measured. */}
          <p
            className="inline-flex items-center gap-1.5 rounded-full border bg-success-soft px-3 py-1 text-sm font-medium text-success"
            role="status"
          >
            <Timer className="size-4" aria-hidden="true" /> Built in {formatDuration(durationMs)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.summary.map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        {data.rowCount === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No records match these filters.</p>
        ) : (
          <div
            className="max-h-[36rem] overflow-auto rounded-lg border"
            tabIndex={0}
            role="region"
            aria-label={`${data.title} preview`}
          >
            <Table containerClassName="overflow-visible">
              <caption className="sr-only">{data.title} preview</caption>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  {cols.map((c) => (
                    <TableHead key={c.key} scope="col" className={cn(isNumeric(c.format) && "text-right")}>
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section, si) => (
                  <Fragment key={si}>
                    {section.title && section.groups.some((g) => g.rows.length) ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={cols.length} className="pt-5 text-base font-semibold text-primary">
                          {section.title}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {section.groups.map((group, gi) =>
                      group.rows.length === 0 ? null : (
                        <Fragment key={gi}>
                          {group.title ? (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={cols.length} className="pt-3 text-sm font-semibold">
                                {group.title}
                              </TableCell>
                            </TableRow>
                          ) : null}
                          {group.rows.map((row, ri) => renderRow(row, `${si}-${gi}-${ri}`))}
                          {group.subtotal && group.complete
                            ? renderRow(group.subtotal, `${si}-${gi}-sub`, "subtotal")
                            : null}
                        </Fragment>
                      ),
                    )}
                    {section.subtotal && section.complete ? renderRow(section.subtotal, `${si}-total`, "total") : null}
                  </Fragment>
                ))}
                {data.grandTotal ? renderRow(data.grandTotal, "grand", "total") : null}
              </TableBody>
            </Table>
          </div>
        )}
        {data.rowCount > PREVIEW_LIMIT ? (
          <p className="text-sm text-muted-foreground">
            Showing the first {formatNumber(PREVIEW_LIMIT)} of {formatNumber(data.rowCount)} rows. Exports include
            everything.
          </p>
        ) : null}
        <ul className="space-y-1 text-xs text-muted-foreground">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
