import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { AssetForm } from "@/components/inventory/asset-form"
import { PageContainer, PageHeader, PageHeaderSkeleton } from "@/components/layout/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { requirePermission } from "@/lib/auth"
import { can, canEditAsset } from "@/lib/permissions"
import { getAsset } from "@/lib/queries/assets"
import { getCategories, getLocations } from "@/lib/queries/settings"
import { emptyAssetForm } from "@/lib/validation/asset"

export const metadata: Metadata = { title: "Edit item" }

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v))

export default function EditItemPage(props: PageProps<"/inventory/[id]/edit">) {
  return (
    <PageContainer className="max-w-4xl">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <Skeleton className="h-[40rem] w-full rounded-2xl" />
          </>
        }
      >
        <EditForm params={props.params} />
      </Suspense>
    </PageContainer>
  )
}

async function EditForm({ params }: { params: PageProps<"/inventory/[id]/edit">["params"] }) {
  const user = await requirePermission("assets.create")
  const { id } = await params
  const [asset, categories, locations] = await Promise.all([getAsset(id), getCategories(), getLocations()])
  if (!asset) notFound()
  // Staff can edit only items they added.
  if (!canEditAsset(user.role, user.id, asset.created_by)) redirect(`/inventory/${asset.id}`)

  const license = asset.license
  const custom = (
    asset.custom_fields && typeof asset.custom_fields === "object" && !Array.isArray(asset.custom_fields)
      ? asset.custom_fields
      : {}
  ) as Record<string, string | number | null>

  const defaults = emptyAssetForm({
    kind: asset.kind,
    asset_tag: asset.asset_tag,
    name: asset.name,
    description: str(asset.description),
    category_id: str(asset.category_id),
    location_id: str(asset.location_id),
    status: asset.status === "checked_out" ? "available" : asset.status,
    condition: str(asset.condition),
    serial_number: str(asset.serial_number),
    manufacturer: str(asset.manufacturer),
    model: str(asset.model),
    acquisition_date: str(asset.acquisition_date),
    acquisition_cost: str(asset.acquisition_cost),
    funding_source: str(asset.funding_source),
    vendor: str(asset.vendor),
    notes: str(asset.notes),
    custom_fields: Object.fromEntries(Object.entries(custom).map(([k, v]) => [k, str(v)])),
    ...(license
      ? {
          seats_total: str(license.seats_total),
          license_type: license.license_type,
          billing_cycle: license.billing_cycle,
          cost_per_period: str(license.cost_per_period),
          renewal_date: str(license.renewal_date),
          expires_at: str(license.expires_at),
          platform_url: str(license.platform_url),
          admin_contact: str(license.admin_contact),
          contract_number: str(license.contract_number),
          license_key_hint: str(license.license_key_hint),
        }
      : {}),
  })

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/inventory/${asset.id}`} className="hover:underline">
            {asset.name} · <span className="font-mono">{asset.asset_tag}</span>
          </Link>
        }
        title="Edit item"
      />
      <AssetForm
        mode="edit"
        assetId={asset.id}
        defaultValues={defaults}
        categories={categories.map((c) => ({ id: c.id, label: c.label, kind: c.kind, custom_fields: c.custom_fields }))}
        locations={locations.map((l) => ({ value: l.id, label: l.name }))}
        nextTag={null}
        canEditTag={user.role === "admin"}
        canRetire={can(user.role, "assets.retire")}
        lockedStatus={asset.status === "checked_out" ? "checked_out" : null}
      />
    </>
  )
}
