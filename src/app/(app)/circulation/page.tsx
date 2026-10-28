import { AlertTriangle, CalendarClock, ListChecks } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { CirculationDesk } from "@/components/circulation/circulation-desk"
import { LoanTable } from "@/components/circulation/loan-table"
import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requirePermission } from "@/lib/auth"
import { formatNumber } from "@/lib/format"
import { getOpenLoans } from "@/lib/queries/circulation"
import { getInstitution } from "@/lib/queries/settings"

export const metadata: Metadata = { title: "Circulation desk" }

export default function CirculationPage(props: PageProps<"/circulation">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Check out · Check in"
        title="Circulation desk"
        description="Check items out and back in. Works with typed tags, USB barcode scanners and tablet cameras."
      />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
        <Desk searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Loans />
      </Suspense>
    </PageContainer>
  )
}

async function Desk({ searchParams }: { searchParams: PageProps<"/circulation">["searchParams"] }) {
  await requirePermission("circulation.use")
  const [params, institution] = await Promise.all([searchParams, getInstitution()])
  const assetId = typeof params.asset === "string" && /^[0-9a-f-]{36}$/i.test(params.asset) ? params.asset : undefined
  return (
    <CirculationDesk
      // Remount when a different item is preselected from the lists below.
      key={assetId ?? "desk"}
      defaultLoanDays={institution.default_loan_days}
      initialAssetId={assetId}
      initialMode={params.mode === "in" ? "in" : "out"}
      autoScan={params.scan === "1"}
    />
  )
}

async function Loans() {
  await requirePermission("circulation.use")
  const loans = await getOpenLoans()

  return (
    <Card>
      <CardHeader>
        <CardTitle>On loan right now</CardTitle>
        <CardDescription>
          {formatNumber(loans.all.length)} physical items are checked out.{" "}
          <Link href="/inventory?status=checked_out" className="text-primary underline underline-offset-4">
            View in catalog
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={loans.overdue.length > 0 ? "overdue" : "week"}>
          <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="overdue" className="gap-1.5">
              <AlertTriangle aria-hidden="true" /> Overdue ({formatNumber(loans.overdue.length)})
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-1.5">
              <CalendarClock aria-hidden="true" /> Due this week ({formatNumber(loans.dueThisWeek.length)})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-1.5">
              <ListChecks aria-hidden="true" /> All ({formatNumber(loans.all.length)})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overdue">
            {loans.overdue.length ? (
              <LoanTable rows={loans.overdue} caption="Overdue items" canCheckIn />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing is overdue. 🎉</p>
            )}
          </TabsContent>
          <TabsContent value="week">
            {loans.dueThisWeek.length ? (
              <LoanTable rows={loans.dueThisWeek} caption="Items due in the next 7 days" canCheckIn />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing is due in the next 7 days.</p>
            )}
          </TabsContent>
          <TabsContent value="all">
            {loans.all.length ? (
              <LoanTable rows={loans.all} caption="All items on loan" canCheckIn />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No items are checked out.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
