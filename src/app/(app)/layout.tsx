import { Suspense } from "react"

import { LiveRefresh } from "@/components/layout/live-refresh"
import { SkipLink } from "@/components/layout/skip-link"
import { TopNav, TopNavFallback } from "@/components/layout/top-nav"
import { getCurrentUser } from "@/lib/auth"
import { getInstitution } from "@/lib/queries/settings"

async function NavForUser() {
  const [user, institution] = await Promise.all([getCurrentUser(), getInstitution()])
  return <TopNav user={{ name: user.fullName, email: user.email, role: user.role }} institutionName={institution.name} />
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <Suspense fallback={<TopNavFallback />}>
        <NavForUser />
      </Suspense>
      <LiveRefresh />
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-x-clip pb-24 outline-none">
        {children}
      </main>
    </div>
  )
}
