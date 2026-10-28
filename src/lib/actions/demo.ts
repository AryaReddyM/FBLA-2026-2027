"use server"

import { revalidatePath } from "next/cache"

import { fail, ok, type ActionResult } from "@/lib/action-result"
import { getCurrentUser } from "@/lib/auth"
import { DEMO_ACCOUNTS, isDemoResetEnabled } from "@/lib/config"
import { generateDemoData } from "@/lib/demo/generate"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Admin-only "Reset demo data": wipes inventory, loans, reports and the audit
 * log, then reloads the fictional demo school. User accounts are kept.
 */
export async function resetDemoData(): Promise<ActionResult<{ assets: number; checkouts: number }>> {
  const user = await getCurrentUser()
  if (user.role !== "admin") return fail("Only admins can reset demo data.")
  if (!isDemoResetEnabled()) return fail("Demo reset only works in the demo project. This is a real school inventory.")

  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("email", DEMO_ACCOUNTS.map((a) => a.email))
  const idFor = (role: string) => {
    const email = DEMO_ACCOUNTS.find((a) => a.role === role)?.email
    return profiles?.find((p) => p.email === email)?.id ?? user.id
  }

  const payload = generateDemoData({
    admin: idFor("admin"),
    manager: idFor("manager"),
    staff: idFor("staff"),
    viewer: idFor("viewer"),
  })
  const { data, error } = await admin.rpc("admin_load_demo_data", { p: payload })
  if (error) return fail(`Reset failed: ${error.message}`)

  // Uploaded photos and stored report files belonged to the old data.
  for (const bucket of ["asset-photos", "reports"] as const) {
    const { data: folders } = await admin.storage.from(bucket).list("", { limit: 1000 })
    for (const folder of folders ?? []) {
      const { data: files } = await admin.storage.from(bucket).list(folder.name, { limit: 1000 })
      const paths = (files ?? []).map((f) => `${folder.name}/${f.name}`)
      if (paths.length) await admin.storage.from(bucket).remove(paths)
    }
  }

  revalidatePath("/", "layout")
  const counts = (data ?? {}) as { assets?: number; checkouts?: number }
  return ok({ assets: counts.assets ?? 0, checkouts: counts.checkouts ?? 0 })
}
