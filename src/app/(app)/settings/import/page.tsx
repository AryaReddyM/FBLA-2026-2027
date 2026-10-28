import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { ImportWizard } from "@/components/settings/import-wizard"
import { Skeleton } from "@/components/ui/skeleton"
import { requirePermission } from "@/lib/auth"
import { getCategories, getLocations } from "@/lib/queries/settings"

export const metadata: Metadata = { title: "Import CSV" }

export default function ImportPage() {
  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Administration"
        title="Import from a spreadsheet"
        description="Bring an existing paper-to-spreadsheet inventory into EduTrack. Every row is checked first, and nothing is imported halfway."
      />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <Importer />
      </Suspense>
    </PageContainer>
  )
}

async function Importer() {
  await requirePermission("import.run")
  const [categories, locations] = await Promise.all([getCategories(), getLocations()])
  return (
    <ImportWizard
      lookups={{
        categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
        locations: locations.map((l) => ({ id: l.id, name: l.name })),
      }}
    />
  )
}
