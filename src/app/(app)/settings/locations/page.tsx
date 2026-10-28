import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { LocationsManager } from "@/components/settings/locations-manager"
import { Skeleton } from "@/components/ui/skeleton"
import { requirePermission } from "@/lib/auth"
import { getLocations, getProfiles } from "@/lib/queries/settings"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Locations" }

export default function LocationsPage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Locations"
        description="Classrooms, labs, the library and storage areas where physical items live."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Locations />
      </Suspense>
    </PageContainer>
  )
}

async function Locations() {
  await requirePermission("settings.catalog")
  const supabase = await createClient()
  const [locations, profiles, { data: assets }] = await Promise.all([
    getLocations(),
    getProfiles(),
    supabase.from("assets").select("location_id").is("deleted_at", null).limit(100_000),
  ])
  const counts = new Map<string, number>()
  for (const a of assets ?? []) if (a.location_id) counts.set(a.location_id, (counts.get(a.location_id) ?? 0) + 1)
  const names = new Map(profiles.map((p) => [p.id, p.full_name]))

  return (
    <LocationsManager
      locations={locations.map((l) => ({
        ...l,
        manager_name: l.manager_id ? (names.get(l.manager_id) ?? null) : null,
        item_count: counts.get(l.id) ?? 0,
      }))}
      people={profiles.filter((p) => p.is_active).map((p) => ({ value: p.id, label: p.full_name || p.email }))}
    />
  )
}
