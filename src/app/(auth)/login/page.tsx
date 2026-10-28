import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginForm } from "@/components/auth/login-form"
import { Skeleton } from "@/components/ui/skeleton"
import { DEMO_ACCOUNTS, isDemoMode } from "@/lib/config"

export const metadata: Metadata = { title: "Sign in" }

const ERRORS: Record<string, string> = {
  inactive: "Your account has been deactivated. Ask your school's EduTrack admin to turn it back on.",
  "no-profile": "We couldn't find your profile. Ask an admin to check your account.",
  "link-expired": "That sign-in link has expired or was already used. Request a new one.",
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams
  const errorKey = typeof params.error === "string" ? params.error : undefined
  const next = typeof params.next === "string" ? params.next : undefined
  const showDemo = isDemoMode()
  return (
    <LoginForm
      next={next}
      initialError={errorKey ? (ERRORS[errorKey] ?? null) : null}
      demoAccounts={showDemo ? DEMO_ACCOUNTS.map((a) => ({ email: a.email, role: a.role })) : []}
    />
  )
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in with your school account.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  )
}
