import { Suspense } from "react"

import { SkipLink } from "@/components/layout/skip-link"
import { TopNav, TopNavFallback } from "@/components/layout/top-nav"
import { getCurrentUser } from "@/lib/auth"
import { isDemoMode } from "@/lib/config"
import { getInstitution } from "@/lib/queries/settings"

async function NavForUser() {
  const [user, institution] = await Promise.all([getCurrentUser(), getInstitution()])
  return (
    <TopNav
      user={{ name: user.fullName, email: user.email, role: user.role }}
      institutionName={institution.name}
      demo={isDemoMode()}
    />
  )
}

/**
 * Shell for every signed-in page: the dark green top navigation, then the
 * page itself (which starts with its own matching hero band). Anything that
 * needs the signed-in user streams in behind <Suspense>, so the frame paints
 * instantly.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <Suspense fallback={<TopNavFallback />}>
        <NavForUser />
      </Suspense>
      {/* overflow-x: clip lets the hero bands reach the screen edges without a sideways scrollbar. */}
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-x-clip pb-24 outline-none">
        {children}
      </main>
    </div>
  )
}
