"use server"

import { revalidatePath } from "next/cache"

import { fail, ok, type ActionResult } from "@/lib/action-result"
import { getCurrentUser } from "@/lib/auth"
import { removeAllStoredFiles } from "@/lib/storage-cleanup"
import { createClient } from "@/lib/supabase/server"

/**
 * Admin-only "Start fresh": deletes every item, loan, saved report and history
 * entry so the school starts with an empty catalog. Accounts, locations and
 * categories are kept.
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
