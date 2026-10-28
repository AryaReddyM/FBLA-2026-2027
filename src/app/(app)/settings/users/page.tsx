import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { UsersManager } from "@/components/settings/users-manager"
import { Skeleton } from "@/components/ui/skeleton"
import { requirePermission } from "@/lib/auth"
import { getProfiles } from "@/lib/queries/settings"

export const metadata: Metadata = { title: "Users & roles" }

export default function UsersPage() {
  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        description="Add staff accounts, choose what each person can do, and turn off access for people who've left."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Users />
      </Suspense>
    </PageContainer>
  )
}

async function Users() {
  const me = await requirePermission("settings.users")
  const profiles = await getProfiles()
  return <UsersManager users={profiles} currentUserId={me.id} />
}
