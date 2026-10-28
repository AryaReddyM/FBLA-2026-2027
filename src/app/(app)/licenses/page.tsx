import { addMonths, format, startOfMonth } from "date-fns"
import { KeyRound, PlusSquare } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { StatusBadge, DueSoonBadge, OverdueBadge } from "@/components/inventory/status-badge"
import { EmptyState } from "@/components/layout/empty-state"
import { PageContainer, PageHeader, StatStrip } from "@/components/layout/page-header"
import { SeatMeter } from "@/components/licenses/seat-meter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCurrentUser } from "@/lib/auth"
import { daysUntil, formatDate, formatMoney, formatNumber } from "@/lib/format"
import { LICENSE_TYPE_LABELS } from "@/lib/labels"
import { can } from "@/lib/permissions"
import { getLicenses, type LicenseRow } from "@/lib/queries/licenses"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Digital licenses" }

export default function LicensesPage() {
  return (
    <PageContainer>
      <PageHeader
        overlap
        eyebrow="Digital resources"
        title="Digital licenses"
        description="Software, e-books and subscriptions: seats in use, what they cost, and when they renew."
      />
      <Suspense fallback={<LicensesSkeleton />}>
        <Licenses />
      </Suspense>
    </PageContainer>
  )
}

function RenewalBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const days = daysUntil(date) ?? 0
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="text-sm whitespace-nowrap">{formatDate(date)}</span>
      {days < 0 ? (
        <OverdueBadge label="Renewal date passed" />
      ) : days <= 30 ? (
        <OverdueBadge label={`Renews in ${days} days`} />
      ) : days <= 60 ? (
        <DueSoonBadge label={`Renews in ${days} days`} />
      ) : null}
    </span>
  )
}

async function Licenses() {
  const user = await getCurrentUser()
  const licenses = await getLicenses()
  const canCirculate = can(user.role, "circulation.use")
  const canEdit = can(user.role, "assets.write")

  if (licenses.length === 0) {
    return (
      <EmptyState
        icon={KeyRound}
        title="No digital licenses yet"
        description="Register software, e-books or subscriptions to track seats and renewals."
        className="relative z-10 -mt-24 sm:-mt-28"
      >
        {canEdit ? (
          <Button asChild>
            <Link href="/inventory/new?kind=digital">Register a license</Link>
          </Button>
        ) : null}
      </EmptyState>
    )
  }

  const active = licenses.filter((l) => l.status !== "retired")
  const annualSpend = active.reduce((sum, l) => sum + (l.annual_cost ?? 0), 0)
  const seatsPurchased = active.reduce((sum, l) => sum + (l.seats_total ?? 0), 0)
  const seatsUsed = active.filter((l) => l.seats_total !== null).reduce((sum, l) => sum + l.seats_used, 0)
  const renewingSoon = active.filter((l) => {
    const d = daysUntil(l.renewal_date)
    return d !== null && d >= 0 && d <= 60
  })

  // Renewal calendar: the next 12 months, starting this month.
  const firstMonth = startOfMonth(new Date())
  const months = Array.from({ length: 12 }, (_, i) => addMonths(firstMonth, i))
  const byMonth = new Map<string, LicenseRow[]>()
  for (const l of active) {
    if (!l.renewal_date) continue
    const key = l.renewal_date.slice(0, 7)
    byMonth.set(key, [...(byMonth.get(key) ?? []), l])
  }

  return (
    <>
      <StatStrip
        label="License summary"
        stats={[
          { label: "Active licenses", value: formatNumber(active.length), hint: "Software, e-books and subscriptions" },
          {
            label: "Yearly spend",
            value: formatMoney(annualSpend, { whole: true }),
            hint: "All billing cycles, per year",
          },
          {
            label: "Seats in use",
            value: `${formatNumber(seatsUsed)} / ${formatNumber(seatsPurchased)}`,
            hint: seatsPurchased ? `${Math.round((seatsUsed / seatsPurchased) * 100)}% of purchased seats` : undefined,
          },
          {
            label: "Renewing in 60 days",
            value: formatNumber(renewingSoon.length),
            hint: renewingSoon.length ? "Decide whether to renew or resize" : "Nothing due soon",
            tone: renewingSoon.length ? "warning" : undefined,
          },
        ]}
      />

      <Tabs defaultValue="table">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="table">All licenses</TabsTrigger>
            <TabsTrigger value="calendar">Renewal calendar</TabsTrigger>
          </TabsList>
          {canEdit ? (
            <Button asChild>
              <Link href="/inventory/new?kind=digital">
                <PlusSquare aria-hidden="true" /> Add license
              </Link>
            </Button>
          ) : null}
        </div>

        <TabsContent value="table" className="mt-4">
          <div
            className="hidden overflow-x-auto rounded-xl border bg-card md:block"
            tabIndex={0}
            role="region"
            aria-label="Licenses table"
          >
            <Table>
              <caption className="sr-only">Digital licenses and subscriptions</caption>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>License</TableHead>
                  <TableHead className="w-56">Seats</TableHead>
                  <TableHead>Renewal</TableHead>
                  <TableHead className="text-right">Per year</TableHead>
                  <TableHead className="text-right">Per used seat</TableHead>
                  {canCirculate ? (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((l) => (
                  <TableRow key={l.id} className={cn(l.status === "retired" && "opacity-60")}>
                    <TableCell>
                      <Link href={`/inventory/${l.id}`} className="font-medium hover:underline">
                        {l.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {LICENSE_TYPE_LABELS[l.license_type]}
                        {l.vendor ? ` · ${l.vendor}` : ""}
                      </span>
                      {l.status !== "available" ? <StatusBadge status={l.status} className="mt-1" /> : null}
                    </TableCell>
                    <TableCell>
                      <SeatMeter used={l.seats_used} total={l.seats_total} />
                    </TableCell>
                    <TableCell>
                      <RenewalBadge date={l.renewal_date} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(l.annual_cost, { whole: true })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.cost_per_used_seat)}</TableCell>
                    {canCirculate ? (
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/circulation?asset=${l.id}&mode=out`}>Assign seat</Link>
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-2 md:hidden" aria-label="Digital licenses">
            {licenses.map((l) => (
              <li key={l.id} className="space-y-3 rounded-xl border bg-card p-3">
                <div>
                  <Link href={`/inventory/${l.id}`} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{LICENSE_TYPE_LABELS[l.license_type]}</p>
                </div>
                <SeatMeter used={l.seats_used} total={l.seats_total} />
                <div className="flex items-start justify-between gap-2 text-sm">
                  <RenewalBadge date={l.renewal_date} />
                  <span className="tabular-nums">{formatMoney(l.annual_cost, { whole: true })}/yr</span>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ol
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-label="Renewals over the next 12 months"
          >
            {months.map((month) => {
              const key = format(month, "yyyy-MM")
              const due = byMonth.get(key) ?? []
              const total = due.reduce((sum, l) => sum + (l.annual_cost ?? 0), 0)
              return (
                <li key={key}>
                  <Card className={cn("h-full gap-3 py-4", due.length === 0 && "bg-muted/30")}>
                    <CardHeader className="px-4">
                      <CardTitle className="text-sm">{format(month, "MMMM yyyy")}</CardTitle>
                      <CardDescription>
                        {due.length
                          ? `${due.length} renewal${due.length === 1 ? "" : "s"} · ${formatMoney(total, { whole: true })}`
                          : "No renewals"}
                      </CardDescription>
                    </CardHeader>
                    {due.length ? (
                      <CardContent className="px-4">
                        <ul className="space-y-1.5">
                          {due.map((l) => (
                            <li key={l.id} className="flex items-baseline justify-between gap-2 text-sm">
                              <Link href={`/inventory/${l.id}`} className="truncate hover:underline">
                                {l.name}
                              </Link>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {format(new Date(`${l.renewal_date}T00:00`), "MMM d")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    ) : null}
                  </Card>
                </li>
              )
            })}
          </ol>
        </TabsContent>
      </Tabs>
    </>
  )
}

function LicensesSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading licenses">
      <Skeleton className="relative z-10 -mt-24 h-36 rounded-2xl sm:-mt-28" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
