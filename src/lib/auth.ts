import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import { can, type Permission, type Role } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export type CurrentUser = {
  id: string
  email: string
  fullName: string
  role: Role
  department: string | null
}

/**
 * Data Access Layer: the one place that answers "who is signed in?".
 * React's cache() means the many components that call it during one request
 * share a single lookup. Signed-out or deactivated users are redirected.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient()
  // getClaims() verifies the JWT signature, unlike getSession(), which just
  // trusts whatever is in the cookie.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, department, is_active")
    .eq("id", userId)
    .maybeSingle()

  if (!profile) redirect("/login?error=no-profile")
  if (!profile.is_active) redirect("/login?error=inactive")

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name || profile.email,
    role: profile.role,
    department: profile.department,
  }
})

/** For pages: send people without the permission back to the dashboard. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!can(user.role, permission)) redirect("/?denied=1")
  return user
}
