import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { CategoriesManager } from "@/components/settings/categories-manager"
import { Skeleton } from "@/components/ui/skeleton"
import { requirePermission } from "@/lib/auth"
import { getCategories } from "@/lib/queries/settings"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Categories" }

export default function CategoriesPage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Categories"
        description="Group items (Chromebooks, Textbooks…), set their useful life for depreciation, and add custom fields like ISBN or MAC address."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Categories />
      </Suspense>
    </PageContainer>
  )
}

async function Categories() {
  await requirePermission("settings.catalog")
  const supabase = await createClient()
  const [categories, { data: assets }] = await Promise.all([
    getCategories(),
    supabase.from("assets").select("category_id").is("deleted_at", null).limit(100_000),
  ])
  const counts = new Map<string, number>()
  for (const a of assets ?? []) if (a.category_id) counts.set(a.category_id, (counts.get(a.category_id) ?? 0) + 1)

  return (
    <CategoriesManager
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        label: c.label,
        kind: c.kind,
        parent_id: c.parent_id,
        useful_life_years: c.own_useful_life_years,
        custom_fields: c.custom_fields,
        item_count: counts.get(c.id) ?? 0,
      }))}
    />
  )
}
