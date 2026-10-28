import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { InstitutionForm } from "@/components/settings/institution-form"
import { ResetDemoButton } from "@/components/settings/reset-demo-button"
import { StartFreshButton } from "@/components/settings/start-fresh-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { requirePermission } from "@/lib/auth"
import { isDemoResetEnabled } from "@/lib/config"
import { getInstitution } from "@/lib/queries/settings"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Institution settings" }

export default function SettingsPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Administration"
        title="Institution settings"
        description="Your school's name, asset tag format, loan length and fiscal year."
      />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <Settings />
      </Suspense>
    </PageContainer>
  )
}

async function Settings() {
  await requirePermission("settings.institution")
  const supabase = await createClient()
  const [institution, { count: itemCount }] = await Promise.all([
    getInstitution(),
    supabase.from("assets").select("id", { count: "exact", head: true }),
  ])
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Institution profile</CardTitle>
        </CardHeader>
        <CardContent>
          <InstitutionForm
            defaults={{
              name: institution.name,
              asset_tag_prefix: institution.asset_tag_prefix,
              default_loan_days: String(institution.default_loan_days),
              fiscal_year_start_month: String(institution.fiscal_year_start_month),
            }}
          />
        </CardContent>
      </Card>

      {isDemoResetEnabled() ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Demo data</CardTitle>
            <CardDescription>
              Restore the fictional demo school before a presentation. Only available in the demo project
              (DEMO_MODE=true).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetDemoButton />
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Start fresh</CardTitle>
          <CardDescription>
            Delete every item, loan, saved report and activity entry to begin with an empty catalog (for example, after
            trying EduTrack with practice data). Accounts, locations and categories are kept.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <StartFreshButton itemCount={itemCount ?? 0} />
          <span className="text-sm text-muted-foreground">
            {(itemCount ?? 0).toLocaleString("en-US")} item{itemCount === 1 ? "" : "s"} in the catalog now.
          </span>
        </CardContent>
      </Card>
    </>
  )
}
