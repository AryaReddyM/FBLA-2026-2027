import { format } from "date-fns"
import { ArrowLeftRight, CalendarClock, Gauge, PlusSquare, ScanLine, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import { BarChartCard } from "@/components/dashboard/bar-chart-card"
import { DueSoonBadge, OverdueBadge } from "@/components/inventory/status-badge"
import { Timeline } from "@/components/inventory/timeline"
import { AnnualSummaryButton } from "@/components/reports/annual-summary-button"
import { HeroSearch } from "@/components/inventory/hero-search"
import { PageContainer, PageHeader, PageHeaderSkeleton, StatStrip } from "@/components/layout/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser, type CurrentUser } from "@/lib/auth"
import { daysUntil, formatDate, formatDuration, formatMoney, formatNumber } from "@/lib/format"
import { STATUS_LABELS } from "@/lib/labels"
import { can } from "@/lib/permissions"
import {
  getDashboardStats,
  getImpactMetrics,
  getMyRecentCheckouts,
  getRecentActivity,
  getRenewalAlerts,
} from "@/lib/queries/dashboard"
import { getInstitution } from "@/lib/queries/settings"

export default function DashboardPage(props: PageProps<"/">) {
  return (
    <PageContainer>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [params, user, institution] = await Promise.all([searchParams, getCurrentUser(), getInstitution()])
  const firstName = user.fullName.split(" ")[0]

  return (
    <>
      <PageHeader
        size="lg"
        overlap
        eyebrow={`${institution.name} · ${format(new Date(), "EEEE, MMMM d")}`}
        title={`Welcome back, ${firstName}.`}
        description="Here's what's happening across your school's physical and digital collections."
        actions={<QuickActions user={user} />}
      >
        <HeroSearch />
      </PageHeader>
      <Suspense fallback={<StatsSkeleton />}>
        <Stats user={user} denied={Boolean(params.denied)} />
      </Suspense>
    </>
  )
}

function QuickActions({ user }: { user: CurrentUser }) {
  return (
    <>
      {can(user.role, "assets.create") ? (
        <Button asChild>
          <Link href="/inventory/new">
            <PlusSquare aria-hidden="true" /> Add inventory
          </Link>
        </Button>
      ) : null}
      <AnnualSummaryButton role={user.role} />
      {can(user.role, "circulation.use") ? (
        <>
          <Button variant="outline" asChild>
            <Link href="/circulation">
              <ArrowLeftRight aria-hidden="true" /> Check out
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/circulation?scan=1">
              <ScanLine aria-hidden="true" /> Scan QR
            </Link>
          </Button>
        </>
      ) : null}
    </>
  )
}

async function Stats({ user, denied }: { user: CurrentUser; denied: boolean }) {
  const canAudit = can(user.role, "audit.view")
  const [stats, renewals, activity, impact] = await Promise.all([
    getDashboardStats(),
    getRenewalAlerts(),
    canAudit ? getRecentActivity(10) : getMyRecentCheckouts(user.id, 10),
    can(user.role, "impact.view") ? getImpactMetrics() : Promise.resolve(null),
  ])

  const available = stats.by_status.find((s) => s.status === "available")?.count ?? 0
  const monthData = (stats.checkouts_by_month ?? []).map((m) => ({
    label: format(new Date(`${m.month}-01T00:00`), "MMM"),
    value: m.count,
  }))
  const schoolYear = new Date(`${stats.school_year_start}T00:00`)

  return (
    <>
      <StatStrip
        stats={[
          {
            label: "Catalog units",
            value: formatNumber(stats.total_assets),
            hint: `${formatNumber(stats.physical_assets)} physical · ${formatNumber(stats.digital_assets)} digital`,
            href: "/inventory",
          },
          {
            label: "Available now",
            value: formatNumber(available),
            hint: stats.total_assets
              ? `${Math.round((available / stats.total_assets) * 100)}% of items ready to lend`
              : "0% of items",
            href: "/inventory?status=available",
          },
          {
            label: "Digital access",
            value: formatNumber(stats.digital_assets),
            hint: `${formatNumber(stats.seats_assigned)} seats assigned · ${formatNumber(stats.licenses_expiring_30)} renewing soon`,
            href: "/licenses",
          },
          {
            label: "Checked out now",
            value: formatNumber(stats.checked_out),
            hint: stats.overdue ? `${formatNumber(stats.overdue)} overdue` : "Nothing overdue",
            tone: stats.overdue ? "danger" : undefined,
            href: "/circulation",
          },
          {
            label: "Catalog value",
            value: formatMoney(stats.total_value, { whole: true }),
            hint: "Original cost of active items",
            href: can(user.role, "reports.all") ? "/reports?type=valuation" : undefined,
          },
        ]}
      />

      {denied ? (
        <Alert>
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>That page needs a different role</AlertTitle>
          <AlertDescription>Ask an admin if you need access.</AlertDescription>
        </Alert>
      ) : null}

      {renewals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-warning" aria-hidden="true" /> Upcoming renewals
            </CardTitle>
            <CardDescription>
              Digital licenses renewing in the next 60 days. Decide now whether to renew, resize or cancel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {renewals.map((r) => {
                const days = daysUntil(r.renewal_date) ?? 0
                return (
                  <li key={r.asset_id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span className="min-w-0">
                      <Link href={`/inventory/${r.asset_id}`} className="block truncate font-medium hover:underline">
                        {r.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(r.renewal_date)}
                        {r.cost != null ? ` · ${formatMoney(r.cost, { whole: true })}` : ""}
                      </span>
                    </span>
                    {days <= 30 ? <OverdueBadge label={`${days} days`} /> : <DueSoonBadge label={`${days} days`} />}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Items by category"
          description="Active items in each category."
          data={stats.by_category.slice(0, 10).map((c) => ({ label: c.name, value: c.count }))}
          valueLabel="Items"
          orientation="horizontal"
        />
        <BarChartCard
          title="Items by acquisition year"
          description="When current items were acquired, from the original research's goods-by-date report."
          data={stats.by_year.map((y) => ({ label: String(y.year), value: y.count }))}
          valueLabel="Items"
        />
        <BarChartCard
          title="Status breakdown"
          description="Every item by its current status."
          data={stats.by_status.map((s) => ({ label: STATUS_LABELS[s.status], value: s.count }))}
          valueLabel="Items"
          orientation="horizontal"
        />
        <BarChartCard
          title="Checkouts per month"
          description={`This school year, starting ${format(schoolYear, "MMMM yyyy")}.`}
          data={monthData}
          valueLabel="Checkouts"
          emptyText="No checkouts yet this school year."
        />
      </div>

      <div className={impact ? "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid gap-4"}>
        <Card>
          <CardHeader>
            <CardTitle>{canAudit ? "Recent activity" : "Your recent checkouts"}</CardTitle>
            <CardDescription>
              {canAudit ? (
                <>
                  The last 10 changes across the school.{" "}
                  <Link href="/audit" className="text-primary underline underline-offset-4">
                    See the full activity log
                  </Link>
                </>
              ) : (
                "Items you lent most recently."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Timeline
              items={activity}
              emptyText={canAudit ? "No activity yet." : "You haven't checked anything out yet."}
            />
          </CardContent>
        </Card>

        {impact ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-5 text-primary" aria-hidden="true" /> Impact
              </CardTitle>
              <CardDescription>
                Median time for the three tasks the original study measured. Visible to admins only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {(
                  [
                    ["Searching the catalog", impact.search],
                    ["Registering an item", impact.registration],
                    ["Generating a report", impact.report],
                  ] as const
                ).map(([label, metric]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <dt className="text-sm">
                      {label}
                      <span className="block text-xs text-muted-foreground">{formatNumber(metric.count)} samples</span>
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums">
                      {metric.median != null ? formatDuration(metric.median) : "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}

function StatsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="relative z-10 -mt-24 h-36 rounded-2xl sm:-mt-28" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <PageHeaderSkeleton size="lg" overlap />
      <StatsSkeleton />
    </>
  )
}
