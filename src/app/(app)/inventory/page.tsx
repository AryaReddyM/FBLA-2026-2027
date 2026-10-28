import { PackageSearch, PlusSquare, Upload } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { CatalogFilters } from "@/components/inventory/catalog-filters"
import { CatalogTable } from "@/components/inventory/catalog-table"
import { HeroSearch } from "@/components/inventory/hero-search"
import { AnnualSummaryButton } from "@/components/reports/annual-summary-button"
import { EmptyState } from "@/components/layout/empty-state"
import { PageContainer, PageHeader, PageHeaderSkeleton, StatStrip } from "@/components/layout/page-header"
import { PaginationNav } from "@/components/layout/pagination-nav"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { CATALOG_PAGE_SIZE } from "@/lib/config"
import { formatMoney, formatNumber, pluralize } from "@/lib/format"
import { can } from "@/lib/permissions"
import { defaultSortDir, getCatalogFacets, parseCatalogParams, searchCatalog } from "@/lib/queries/assets"
import { getDashboardStats } from "@/lib/queries/dashboard"
import { getCategories, getLocations } from "@/lib/queries/settings"

export const metadata: Metadata = { title: "Catalog" }

export default function CatalogPage(props: PageProps<"/inventory">) {
  return (
    <PageContainer>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/inventory">["searchParams"] }) {
  const [raw, user] = await Promise.all([searchParams, getCurrentUser()])
  const params = parseCatalogParams(raw)
  const [result, stats, categories, locations, facets] = await Promise.all([
    searchCatalog(params),
    getDashboardStats(),
    getCategories(),
    getLocations(),
    getCatalogFacets(),
  ])
  const canEdit = can(user.role, "assets.write")
  const filtered = Boolean(
    params.q ||
    params.kind ||
    params.category ||
    params.location ||
    params.status ||
    params.condition ||
    params.year ||
    params.funding,
  )
  const available = stats.by_status.find((s) => s.status === "available")?.count ?? 0
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }))
  const urlParams = {
    q: params.q,
    kind: params.kind,
    category: params.category,
    location: params.location,
    status: params.status,
    condition: params.condition,
    year: params.year,
    funding: params.funding,
    sort: params.sort,
    dir: params.dir,
  }

  return (
    <>
      <PageHeader
        size="lg"
        overlap
        eyebrow="One catalog. Every learning resource."
        title="Find what your institution already has."
        description="Search Chromebooks, textbooks, equipment, software and e-book licenses across your physical and digital collections."
      >
        <HeroSearch defaultQuery={params.q ?? ""} defaultKind={params.kind ?? ""} />
      </PageHeader>

      <StatStrip
        label="Catalog summary"
        stats={[
          { label: "Catalog units", value: formatNumber(stats.total_assets), hint: "Across all collections" },
          {
            label: "Available now",
            value: formatNumber(available),
            hint: stats.total_assets
              ? `${Math.round((available / stats.total_assets) * 100)}% of items`
              : "0% of items",
            href: "/inventory?status=available",
          },
          {
            label: "Digital access",
            value: formatNumber(stats.digital_assets),
            hint: `${formatNumber(stats.seats_assigned)} seats assigned institution-wide`,
            href: "/licenses",
          },
          {
            label: "Catalog value",
            value: formatMoney(stats.total_value, { whole: true }),
            hint: "Original cost of active items",
          },
        ]}
      />

      <section aria-labelledby="browse-heading" className="space-y-4 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* Announced to screen readers whenever the filters change. */}
            <p className="text-sm font-bold text-success" role="status" aria-live="polite">
              {pluralize(result.total, "result")}
            </p>
            <h2 id="browse-heading" className="text-2xl font-semibold tracking-tight">
              Browse the catalog
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnnualSummaryButton role={user.role} />
            {can(user.role, "import.run") ? (
              <Button variant="outline" asChild>
                <Link href="/settings/import">
                  <Upload aria-hidden="true" /> Import CSV
                </Link>
              </Button>
            ) : null}
            {can(user.role, "assets.create") ? (
              <Button asChild>
                <Link href="/inventory/new">
                  <PlusSquare aria-hidden="true" /> Add inventory
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <CatalogFilters
          values={urlParams}
          categories={categories.map((c) => ({ value: c.id, label: c.label }))}
          locations={locationOptions}
          years={facets.years}
          fundingSources={facets.fundingSources}
        />

        {result.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={PackageSearch}
              title="No items match"
              description="Try a different search, or clear some filters."
            >
              <Button variant="outline" asChild>
                <Link href="/inventory">Clear search and filters</Link>
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Your catalog is ready for its first asset."
              description="Staff can add books, devices, digital licenses, and other holdings here or import an existing spreadsheet."
            >
              {can(user.role, "assets.create") ? (
                <Button asChild>
                  <Link href="/inventory/new">Add inventory</Link>
                </Button>
              ) : null}
            </EmptyState>
          )
        ) : (
          <CatalogTable
            rows={result.rows}
            params={urlParams}
            sort={result.sort}
            dir={params.dir ?? defaultSortDir(result.sort)}
            canEdit={canEdit}
            locations={locationOptions}
          />
        )}

        <PaginationNav
          path="/inventory"
          params={urlParams}
          page={params.page ?? 1}
          pageSize={CATALOG_PAGE_SIZE}
          total={result.total}
        />
      </section>
    </>
  )
}

function CatalogSkeleton() {
  return (
    <>
      <PageHeaderSkeleton size="lg" overlap />
      <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading the catalog">
        <Skeleton className="relative z-10 -mt-24 h-36 rounded-2xl sm:-mt-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}
