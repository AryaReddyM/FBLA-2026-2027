import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { PasswordForm, ProfileForm } from "@/components/settings/profile-forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions"

export const metadata: Metadata = { title: "My profile" }

export default function ProfilePage(props: PageProps<"/profile">) {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader eyebrow="Your account" title="My profile" description="Your name, department and password." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Profile searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function Profile({ searchParams }: { searchParams: PageProps<"/profile">["searchParams"] }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  return (
    <>
      {params.reset ? (
        <Alert>
          <AlertDescription>You&apos;re signed in from the reset link. Choose a new password below.</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {user.email} · {ROLE_LABELS[user.role]}: {ROLE_DESCRIPTIONS[user.role]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm defaults={{ full_name: user.fullName, department: user.department ?? "" }} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use at least 8 characters. You stay signed in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </>
  )
}
