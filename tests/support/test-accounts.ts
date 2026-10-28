import { randomBytes, randomUUID } from "node:crypto"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

export const TEST_ROLES = ["admin", "manager", "staff", "viewer"] as const
export type TestRole = (typeof TEST_ROLES)[number]

export type TestAccount = { role: TestRole; id: string; email: string; password: string }

// Tests run against the real database, so every account they create uses this
// reserved domain, which makes them easy to find and delete afterwards.
export const TEST_EMAIL_DOMAIN = "edutrack-tests.example"

export function testEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { url, publicKey, serviceKey, configured: Boolean(url && publicKey && serviceKey) }
}

function serviceClient(): SupabaseClient<Database> {
  const { url, serviceKey } = testEnv()
  if (!url || !serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.")
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function createTestAccounts(): Promise<TestAccount[]> {
  const admin = serviceClient()
  const run = randomUUID().slice(0, 8)
  const accounts: TestAccount[] = []
  for (const role of TEST_ROLES) {
    const email = `${role}-${run}@${TEST_EMAIL_DOMAIN}`
    const password = randomBytes(18).toString("base64url")
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Test ${role}` },
    })
    if (error || !data.user) throw new Error(`Couldn't create ${email}: ${error?.message}`)
    // Sign-up makes new profiles staff (or admin for the first three accounts), so set the role explicitly.
    const { error: roleError } = await admin.from("profiles").update({ role, is_active: true }).eq("id", data.user.id)
    if (roleError) throw new Error(`Couldn't set the role for ${email}: ${roleError.message}`)
    accounts.push({ role, id: data.user.id, email, password })
  }
  return accounts
}

export async function createTestAsset(createdBy: string, name = "Test item") {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("assets")
    .insert({ name, kind: "physical", created_by: createdBy })
    .select("id, asset_tag")
    .single()
  if (error || !data) throw new Error(`Couldn't create a test item: ${error?.message}`)
  return data
}

/** Deletes every test account, including leftovers from a run that crashed, and everything they created. */
export async function deleteTestAccounts() {
  const admin = serviceClient()
  const { data: profiles } = await admin.from("profiles").select("id").like("email", `%@${TEST_EMAIL_DOMAIN}`)
  const userIds = (profiles ?? []).map((p) => p.id)
  if (!userIds.length) return

  const { data: assets } = await admin.from("assets").select("id").in("created_by", userIds)
  const assetIds = (assets ?? []).map((a) => a.id)

  const { data: reports } = await admin.from("report_runs").select("file_path").in("generated_by", userIds)
  const files = (reports ?? []).map((r) => r.file_path).filter((f): f is string => Boolean(f))
  if (files.length) await admin.storage.from("reports").remove(files)

  await admin.from("report_runs").delete().in("generated_by", userIds)
  await admin.from("checkouts").delete().in("checked_out_by", userIds)
  await admin.from("metric_events").delete().in("actor_id", userIds)
  if (assetIds.length) {
    await admin.from("assets").delete().in("id", assetIds)
    await admin.from("audit_log").delete().in("asset_id", assetIds)
    await admin.from("audit_log").delete().in("entity_id", assetIds)
  }
  await admin.from("audit_log").delete().in("actor_id", userIds)

  for (const id of userIds) await admin.auth.admin.deleteUser(id)
  // Deleting an account writes its own audit entry, so this cleanup has to come last.
  await admin.from("audit_log").delete().in("entity_id", userIds)
}
