import { AlertTriangle, CalendarClock, ExternalLink, Printer, UserRound } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense, type ReactNode } from "react"

import { SeatList } from "@/components/circulation/seat-list"
import { AssetActions } from "@/components/inventory/asset-actions"
import { PhotoCard } from "@/components/inventory/photo-card"
import { QrCode } from "@/components/inventory/qr-code"
import { ConditionLabel, KindBadge, OverdueBadge, StatusBadge } from "@/components/inventory/status-badge"
import { Timeline } from "@/components/inventory/timeline"
import { PageContainer, PageHeader, PageHeaderSkeleton } from "@/components/layout/page-header"
import { SeatMeter } from "@/components/licenses/seat-meter"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { straightLineDepreciation } from "@/lib/depreciation"
import { daysUntil, formatDate, formatMoney } from "@/lib/format"
import { annualizedCost, BILLING_CYCLE_LABELS, borrowerLabel, LICENSE_TYPE_LABELS } from "@/lib/labels"
import { getOrigin } from "@/lib/origin"
import { can, canEditAsset } from "@/lib/permissions"
import { getAsset, getAssetTimeline, getOpenCheckouts } from "@/lib/queries/assets"
import { getCategories, getInstitution, getLocations } from "@/lib/queries/settings"
import { labelUrl } from "@/lib/scan"
import { photoUrl } from "@/lib/url"
import { parseCustomFieldSchema } from "@/lib/validation/custom-fields"

export const metadata: Metadata = { title: "Item details" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function AssetPage(props: PageProps<"/inventory/[id]">) {
  return (
    <PageContainer>
      <Suspense fallback={<DetailSkeleton />}>
        <AssetDetail params={props.params} />
      </Suspense>
    </PageContainer>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm break-words">{children ?? "—"}</dd>
    </div>
  )
}

async function AssetDetail({ params }: { params: PageProps<"/inventory/[id]">["params"] }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const user = await getCurrentUser()
  const [asset, openLoans, institution, categories, locations, origin] = await Promise.all([
    getAsset(id),
    getOpenCheckouts(id),
    getInstitution(),
    getCategories(),
    getLocations(),
    getOrigin(),
  ])
  if (!asset) notFound()
  const timeline = await getAssetTimeline(id, can(user.role, "audit.view"))

  const category = categories.find((c) => c.id === asset.category_id)
  const customDefs = parseCustomFieldSchema(asset.category?.custom_field_schema)
  const customValues = (asset.custom_fields ?? {}) as Record<string, string | number | null>
  const license = asset.license
  const physical = asset.kind === "physical"
  const loan = physical ? openLoans[0] : undefined
  const overdueDays = loan?.due_at ? daysUntil(loan.due_at) : null
  const depreciation = physical
    ? straightLineDepreciation({
        cost: asset.acquisition_cost,
        acquisitionDate: asset.acquisition_date,
        usefulLifeYears: category?.useful_life_years,
      })
    : null
  const renewalIn = license?.renewal_date ? daysUntil(license.renewal_date) : null

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/inventory" className="hover:underline">
            Catalog
          </Link>
        }
        title={asset.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-white">{asset.asset_tag}</span>
            <StatusBadge status={asset.status} />
            {[asset.manufacturer, asset.model].filter(Boolean).join(" ")}
          </span>
        }
        actions={
          <AssetActions
            asset={{
              id: asset.id,
              name: asset.name,
              asset_tag: asset.asset_tag,
              kind: asset.kind,
              status: asset.status,
              condition: asset.condition,
              location_id: asset.location_id,
            }}
            openLoans={openLoans.map((l) => ({
              id: l.id,
              borrower: borrowerLabel(l.borrower_type, l.borrower_name, l.borrower_ref),
            }))}
            seatsFull={license?.seats_total != null && openLoans.length >= license.seats_total}
            canCirculate={can(user.role, "circulation.use")}
            canEdit={canEditAsset(user.role, user.id, asset.created_by)}
            canManage={can(user.role, "assets.write")}
            isAdmin={user.role === "admin"}
            locations={locations.map((l) => ({ value: l.id, label: l.name }))}
            defaultLoanDays={institution.default_loan_days}
          />
        }
      />

      {overdueDays !== null && overdueDays < 0 ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>
            Overdue by {Math.abs(overdueDays)} day{overdueDays === -1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            It was due back on {formatDate(loan?.due_at)} from{" "}
            {loan ? borrowerLabel(loan.borrower_type, loan.borrower_name, loan.borrower_ref) : ""}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                <Detail label="Kind">
                  <KindBadge kind={asset.kind} />
                </Detail>
                <Detail label="Category">{category?.label ?? asset.category?.name}</Detail>
                {physical ? <Detail label="Location">{asset.location?.name}</Detail> : null}
                {physical ? (
                  <Detail label="Condition">
                    <ConditionLabel condition={asset.condition} />
                  </Detail>
                ) : null}
                {physical ? (
                  <Detail label="Serial number">
                    {asset.serial_number ? <span className="font-mono">{asset.serial_number}</span> : null}
                  </Detail>
                ) : null}
                <Detail label="Manufacturer / model">
                  {[asset.manufacturer, asset.model].filter(Boolean).join(" ") || null}
                </Detail>
                <Detail label="Acquired">{asset.acquisition_date ? formatDate(asset.acquisition_date) : null}</Detail>
                <Detail label="Cost">
                  {asset.acquisition_cost != null ? formatMoney(asset.acquisition_cost) : null}
                </Detail>
                <Detail label="Funding source">{asset.funding_source}</Detail>
                <Detail label="Vendor">{asset.vendor}</Detail>
                <Detail label="Registered">
                  {formatDate(asset.created_at)}
                  {asset.creator?.full_name ? ` by ${asset.creator.full_name}` : ""}
                </Detail>
                {asset.retired_at ? <Detail label="Retired">{formatDate(asset.retired_at)}</Detail> : null}
                {customDefs.map((def) => (
                  <Detail key={def.key} label={def.label}>
                    {customValues[def.key] != null && customValues[def.key] !== ""
                      ? def.type === "date"
                        ? formatDate(String(customValues[def.key]))
                        : String(customValues[def.key])
                      : null}
                  </Detail>
                ))}
              </dl>
              {asset.description ? (
                <p className="mt-5 border-t pt-4 text-sm whitespace-pre-line">{asset.description}</p>
              ) : null}
            </CardContent>
          </Card>

          {license ? (
            <Card>
              <CardHeader>
                <CardTitle>License and seats</CardTitle>
                <CardDescription>
                  {LICENSE_TYPE_LABELS[license.license_type]} · billed{" "}
                  {BILLING_CYCLE_LABELS[license.billing_cycle].toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <SeatMeter used={openLoans.length} total={license.seats_total} />
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Detail label="Renewal">
                    {license.renewal_date ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                        {formatDate(license.renewal_date)}
                        {renewalIn !== null && renewalIn >= 0 && renewalIn <= 60 ? (
                          <span className="text-warning">(in {renewalIn} days)</span>
                        ) : null}
                      </span>
                    ) : null}
                  </Detail>
                  <Detail label="Expires">{license.expires_at ? formatDate(license.expires_at) : null}</Detail>
                  <Detail label="Cost per period">
                    {license.cost_per_period != null ? formatMoney(license.cost_per_period) : null}
                  </Detail>
                  <Detail label="Annual cost">
                    {formatMoney(annualizedCost(license.cost_per_period, license.billing_cycle))}
                  </Detail>
                  <Detail label="Cost per used seat">
                    {license.cost_per_period != null && openLoans.length > 0
                      ? formatMoney(
                          (annualizedCost(license.cost_per_period, license.billing_cycle) ?? 0) / openLoans.length,
                        )
                      : null}
                  </Detail>
                  <Detail label="Contract">{license.contract_number}</Detail>
                  <Detail label="Vendor contact">{license.admin_contact}</Detail>
                  <Detail label="Key hint">
                    {license.license_key_hint ? `•••• ${license.license_key_hint}` : null}
                  </Detail>
                  <Detail label="Admin console">
                    {license.platform_url ? (
                      <a
                        href={license.platform_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Open <ExternalLink className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : null}
                  </Detail>
                </dl>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Assigned seats</h3>
                  <SeatList
                    canRelease={can(user.role, "circulation.use")}
                    seats={openLoans.map((l) => ({
                      id: l.id,
                      borrower: borrowerLabel(l.borrower_type, l.borrower_name, l.borrower_ref),
                      since: l.checked_out_at,
                    }))}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {physical ? (
            <Card>
              <CardHeader>
                <CardTitle>Value and depreciation</CardTitle>
                <CardDescription>
                  Straight-line over {category?.useful_life_years ?? "?"} years
                  {category?.useful_life_years ? " (from the category)" : ""}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {depreciation ? (
                  <div className="space-y-4">
                    <dl className="grid gap-4 sm:grid-cols-4">
                      <Detail label="Original cost">{formatMoney(depreciation.cost)}</Detail>
                      <Detail label="Per year">{formatMoney(depreciation.annualDepreciation)}</Detail>
                      <Detail label="Depreciated so far">{formatMoney(depreciation.accumulatedDepreciation)}</Detail>
                      <Detail label="Current book value">
                        <span className="text-base font-semibold">{formatMoney(depreciation.bookValue)}</span>
                      </Detail>
                    </dl>
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-chart-2"
                          style={{ width: `${Math.round(depreciation.lifeUsed * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(depreciation.lifeUsed * 100)}% of its useful life used
                        {depreciation.fullyDepreciated ? " · fully depreciated" : ""}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add a cost, an acquisition date and a category with a useful life to see the current book value.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {asset.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{asset.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>
                {can(user.role, "audit.view")
                  ? "Every change and loan, newest first."
                  : "Loans of this item, newest first."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline items={timeline} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6" aria-label="Item summary">
          {physical ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Currently with</CardTitle>
              </CardHeader>
              <CardContent>
                {loan ? (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 font-medium">
                      <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                      {borrowerLabel(loan.borrower_type, loan.borrower_name, loan.borrower_ref)}
                    </p>
                    {loan.borrower_type === "student" && can(user.role, "circulation.use") ? (
                      <p className="text-sm text-muted-foreground">{loan.borrower_name}</p>
                    ) : null}
                    <p className="text-sm">
                      Since {formatDate(loan.checked_out_at)}
                      {loan.checked_out_by_profile?.full_name ? ` · by ${loan.checked_out_by_profile.full_name}` : ""}
                    </p>
                    {loan.due_at ? (
                      overdueDays !== null && overdueDays < 0 ? (
                        <OverdueBadge label={`Overdue · due ${formatDate(loan.due_at)}`} />
                      ) : (
                        <p className="text-sm">Due {formatDate(loan.due_at)}</p>
                      )
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {asset.status === "available" ? "On the shelf. Available to check out." : "Not checked out."}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">QR label</CardTitle>
              <CardDescription>Scan with any phone camera to open this page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="mx-auto w-44 rounded-lg border bg-white p-3">
                <QrCode
                  value={labelUrl(origin, asset.asset_tag)}
                  label={`QR code for ${asset.asset_tag}`}
                  className="text-black"
                />
              </div>
              <p className="text-center font-mono text-sm">{asset.asset_tag}</p>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/inventory/labels?ids=${asset.id}`}>
                  <Printer aria-hidden="true" /> Print label
                </Link>
              </Button>
            </CardContent>
          </Card>

          <PhotoCard
            assetId={asset.id}
            name={asset.name}
            url={photoUrl(asset.image_path)}
            canEdit={can(user.role, "assets.write")}
          />
        </aside>
      </div>
    </>
  )
}

function DetailSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
        role="status"
        aria-busy="true"
        aria-label="Loading item"
      >
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    </>
  )
}
