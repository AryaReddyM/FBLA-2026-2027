"use client"

import { SlidersHorizontal, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CONDITION_LABELS, STATUS_LABELS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { withQuery, type QueryValue } from "@/lib/url"

export type CatalogFilterValues = {
  q?: string
  kind?: string
  category?: string
  location?: string
  status?: string
  condition?: string
  year?: number
  funding?: string
  sort?: string
  dir?: string
}

type Option = { value: string; label: string }

type Props = {
  values: CatalogFilterValues
  categories: Option[]
  locations: Option[]
  years: number[]
  fundingSources: string[]
}

const toOptions = (labels: Record<string, string>): Option[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }))

/**
 * Filter dropdowns for the catalog (the keyword search and format live in the
 * hero search bar above). Every change rewrites the URL
 * (?status=available&location=…), which re-renders the server page with the
 * new results, so filtered views can be bookmarked and shared.
 */
export function CatalogFilters({ values, categories, locations, years, fundingSources }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showFilters, setShowFilters] = useState(false)

  function navigate(patch: Partial<Record<keyof CatalogFilterValues, QueryValue>>) {
    const next = { ...values, ...patch, page: undefined }
    startTransition(() => {
      router.replace(withQuery("/inventory", next), { scroll: false })
    })
  }

  const activeCount = (["kind", "category", "location", "status", "condition", "year", "funding"] as const).filter(
    (k) => values[k] !== undefined,
  ).length

  const filters: { key: keyof CatalogFilterValues; label: string; options: Option[] }[] = [
    { key: "category", label: "Category", options: categories },
    { key: "location", label: "Location", options: locations },
    { key: "status", label: "Status", options: toOptions(STATUS_LABELS) },
    { key: "condition", label: "Condition", options: toOptions(CONDITION_LABELS) },
    { key: "year", label: "Acquired", options: years.map((y) => ({ value: String(y), label: String(y) })) },
    { key: "funding", label: "Funding", options: fundingSources.map((f) => ({ value: f, label: f })) },
  ]

  return (
    <section
      aria-label="Filters"
      className={cn("space-y-3 rounded-2xl border bg-card p-3 sm:p-4", pending && "opacity-70")}
    >
      {/* On phones the six dropdowns would push results off-screen, so they fold away. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full sm:hidden"
        aria-expanded={showFilters}
        aria-controls="catalog-filter-grid"
        onClick={() => setShowFilters((v) => !v)}
      >
        <SlidersHorizontal aria-hidden="true" />
        {showFilters ? "Hide filters" : `Filters${activeCount ? ` (${activeCount})` : ""}`}
      </Button>
      <div
        id="catalog-filter-grid"
        className={cn("grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-6", showFilters ? "grid" : "hidden")}
      >
        {filters.map((filter) => {
          const current = values[filter.key] !== undefined ? String(values[filter.key]) : "all"
          const id = `filter-${filter.key}`
          return (
            <div key={filter.key} className="min-w-0 space-y-1">
              <Label htmlFor={id} className="text-xs text-muted-foreground">
                {filter.label}
              </Label>
              <Select value={current} onValueChange={(v) => navigate({ [filter.key]: v === "all" ? undefined : v })}>
                <SelectTrigger id={id} className="w-full" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filter.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      {activeCount > 0 || values.q ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {[
              values.q ? `Searching for “${values.q}”` : null,
              activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} applied` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.replace("/inventory", { scroll: false }))}
          >
            <X aria-hidden="true" /> Clear all
          </Button>
        </div>
      ) : null}
    </section>
  )
}
