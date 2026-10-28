"use server"

import { revalidatePath } from "next/cache"

import { fail, ok, type ActionResult } from "@/lib/action-result"
import { getCurrentUser } from "@/lib/auth"
import { DEMO_ACCOUNTS, isDemoResetEnabled } from "@/lib/config"
import { generateDemoData } from "@/lib/demo/generate"
import { removeAllStoredFiles } from "@/lib/storage-cleanup"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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
  await removeAllStoredFiles()

  revalidatePath("/", "layout")
  const counts = (data ?? {}) as { assets?: number; checkouts?: number }
  return ok({ assets: counts.assets ?? 0, checkouts: counts.checkouts ?? 0 })
}

/**
 * Admin-only "Start fresh": deletes every item, loan, saved report and history
 * entry so the school starts with an empty catalog. Accounts, locations and
 * categories are kept. Unlike demo reset, this works in every project.
 */
export async function startFresh(confirmation: string): Promise<ActionResult<{ removed: number }>> {
  const user = await getCurrentUser()
  if (user.role !== "admin") return fail("Only admins can clear the inventory.")
  if (confirmation.trim().toUpperCase() !== "DELETE") return fail("Type DELETE to confirm.")

  // The user's own client: the database function re-checks that they're an admin.
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_clear_inventory")
  if (error) return fail(`Couldn't clear the inventory: ${error.message}`)
  await removeAllStoredFiles()

  revalidatePath("/", "layout")
  const result = (data ?? {}) as { assets_removed?: number }
  return ok({ removed: result.assets_removed ?? 0 })
}
