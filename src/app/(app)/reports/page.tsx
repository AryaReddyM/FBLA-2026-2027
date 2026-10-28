import { Download, FileBarChart, FileClock } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { EmptyState } from "@/components/layout/empty-state"
import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { ReportControls } from "@/components/reports/report-controls"
import { ReportPreview } from "@/components/reports/report-preview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requirePermission, type CurrentUser } from "@/lib/auth"
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format"
import { can } from "@/lib/permissions"
import { getLocations } from "@/lib/queries/settings"
import { buildReportTimed } from "@/lib/reports/build"
import { REPORT_META, REPORT_TYPES, reportParamsSchema, type ReportType } from "@/lib/reports/definitions"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Reports" }

export default function ReportsPage(props: PageProps<"/reports">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Preview a report on screen, then export it as PDF, Excel or CSV. Every export is saved to the history below."
      />
      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-xl" />}>
        <Reports searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function Reports({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  const user = await requirePermission("reports.own")
  const raw = await searchParams
  const allowed = REPORT_TYPES.filter((t) => can(user.role, REPORT_META[t].permission))
  const requested =
    typeof raw.type === "string" && (allowed as readonly string[]).includes(raw.type)
      ? (raw.type as ReportType)
      : allowed[0]
  const meta = REPORT_META[requested]
  const locations = meta.usesLocation ? await getLocations() : []
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined)
  const values = { location_id: str(raw.location_id), from: str(raw.from), to: str(raw.to) }

  return (
    <div className="grid gap-6 2xl:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label="Report types">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-1">
          {allowed.map((t) => (
            <li key={t}>
              <Link
                href={`/reports?type=${t}`}
                aria-current={t === requested ? "page" : undefined}
                className={cn(
                  "block rounded-xl border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40",
                  t === requested && "border-primary bg-accent ring-1 ring-primary",
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileBarChart className="size-4 text-primary" aria-hidden="true" />
                  {REPORT_META[t].title}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{REPORT_META[t].description}</span>
              </Link>
            </li>
          ))}
        </ul>
        {user.role === "staff" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            As staff, your checkout report covers items you checked out.
          </p>
        ) : null}
      </nav>

      <div className="min-w-0 space-y-4">
        <ReportControls
          key={requested}
          type={requested}
          usesLocation={meta.usesLocation}
          usesDates={meta.usesDates}
          locations={locations.map((l) => ({ value: l.id, label: l.name }))}
          values={values}
        />
        <Suspense
          key={JSON.stringify({ requested, values })}
          fallback={<Skeleton className="h-96 w-full rounded-xl" />}
        >
          <Preview user={user} type={requested} values={values} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <History />
        </Suspense>
      </div>
    </div>
  )
}

async function Preview({
  user,
  type,
  values,
}: {
  user: CurrentUser
  type: ReportType
  values: { location_id?: string; from?: string; to?: string }
}) {
  const parsed = reportParamsSchema.safeParse({ type, ...values })
  if (!parsed.success) {
    return <EmptyState icon={FileBarChart} title="Check the filters" description={parsed.error.issues[0]?.message} />
  }
  const supabase = await createClient()
  const { data, durationMs } = await buildReportTimed(supabase, user, parsed.data)
  return <ReportPreview data={data} durationMs={durationMs} />
}

async function History() {
  const supabase = await createClient()
  const { data: runs } = await supabase
    .from("report_runs")
    .select(
      "id, report_type, format, row_count, duration_ms, created_at, file_path, params, by:profiles!report_runs_generated_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(15)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileClock className="size-5 text-muted-foreground" aria-hidden="true" /> Report history
        </CardTitle>
        <CardDescription>Download any past export again, exactly as it was generated.</CardDescription>
      </CardHeader>
      <CardContent>
        {!runs || runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports exported yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Report history">
            <Table>
              <caption className="sr-only">Previously generated reports</caption>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead>
                    <span className="sr-only">Download</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const params = (run.params ?? {}) as { scope?: string; period?: string }
                  return (
                    <TableRow key={run.id}>
                      <TableCell>
                        <span className="font-medium">
                          {REPORT_META[run.report_type as ReportType]?.title ?? run.report_type}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {run.format.toUpperCase()}
                          {params.scope ? ` · ${params.scope}` : ""}
                          {params.period ? ` · ${params.period}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(run.created_at)}
                        {run.by?.full_name ? (
                          <span className="block text-xs text-muted-foreground">by {run.by.full_name}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(run.row_count)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(run.duration_ms)}</TableCell>
                      <TableCell className="text-right">
                        {run.file_path ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={`/api/reports/runs/${run.id}`}
                              aria-label={`Download ${run.report_type} ${run.format} from ${formatDateTime(run.created_at)}`}
                            >
                              <Download aria-hidden="true" /> Download
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not stored</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
