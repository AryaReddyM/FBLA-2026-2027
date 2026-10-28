import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { AssetForm } from "@/components/inventory/asset-form"
import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { requirePermission } from "@/lib/auth"
import { getNextAssetTag } from "@/lib/actions/assets"
import { getCategories, getLocations } from "@/lib/queries/settings"
import { emptyAssetForm } from "@/lib/validation/asset"

export const metadata: Metadata = { title: "Register item" }

export default function RegisterItemPage(props: PageProps<"/inventory/new">) {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow={
          <Link href="/inventory" className="hover:underline">
            Catalog
          </Link>
        }
        title="Register an item"
        description="Add a Chromebook, textbook, piece of equipment or digital license to the inventory."
      />
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-xl" />}>
        <RegisterForm searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function RegisterForm({ searchParams }: { searchParams: PageProps<"/inventory/new">["searchParams"] }) {
  const user = await requirePermission("assets.write")
  const [params, categories, locations, nextTag] = await Promise.all([
    searchParams,
    getCategories(),
    getLocations(),
    getNextAssetTag(),
  ])
  const kind = params.kind === "digital" ? "digital" : "physical"

  return (
    <AssetForm
      mode="create"
      defaultValues={emptyAssetForm({ kind, condition: kind === "digital" ? "" : "new" })}
      categories={categories.map((c) => ({ id: c.id, label: c.label, kind: c.kind, custom_fields: c.custom_fields }))}
      locations={locations.map((l) => ({ value: l.id, label: l.name }))}
      nextTag={nextTag}
      canEditTag={user.role === "admin" || user.role === "manager"}
    />
  )
}
