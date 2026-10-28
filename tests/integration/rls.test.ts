// @vitest-environment node

import { existsSync } from "node:fs"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { Database } from "@/types/database"

import { createTestAccounts, createTestAsset, deleteTestAccounts, testEnv, testTag, type TestAccount } from "../support/test-accounts"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const { url, publicKey, configured } = testEnv()

async function signIn(account: TestAccount) {
  const client = createClient<Database>(url!, publicKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password })
  if (error) throw new Error(`Sign-in failed for ${account.email}: ${error.message}`)
  return client
}

describe.skipIf(!configured)("row level security (live database)", () => {
  let admin: SupabaseClient<Database>
  let manager: SupabaseClient<Database>
  let staff: SupabaseClient<Database>
  let viewer: SupabaseClient<Database>
  let anon: SupabaseClient<Database>
  let assetId: string

  beforeAll(async () => {
    await deleteTestAccounts()
    const accounts = await createTestAccounts()
    const byRole = (role: TestAccount["role"]) => accounts.find((a) => a.role === role)!
    ;[admin, manager, staff, viewer] = await Promise.all([
      signIn(byRole("admin")),
      signIn(byRole("manager")),
      signIn(byRole("staff")),
      signIn(byRole("viewer")),
    ])
    anon = createClient<Database>(url!, publicKey!, { auth: { persistSession: false } })
    assetId = (await createTestAsset(byRole("admin").id, "RLS test item")).id
  }, 60_000)

  afterAll(async () => {
    await deleteTestAccounts()
  }, 60_000)

  it("signed-out visitors can't read anything", async () => {
    const { data } = await anon.from("assets").select("id").limit(1)
    expect(data ?? []).toHaveLength(0)
  })

  it("every signed-in role can read the catalog", async () => {
    for (const client of [admin, manager, staff, viewer]) {
      const { data, error } = await client.from("assets").select("id").limit(1)
      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    }
  })

  it("staff can add items, and edit the ones they added, but not retire or delete them", async () => {
    const { data, error } = await staff.from("assets").insert({ name: "RLS test staff item", kind: "physical", asset_tag: testTag() }).select("id").single()
    expect(error).toBeNull()
    const { data: edited } = await staff.from("assets").update({ notes: "edited by its owner" }).eq("id", data!.id).select("id")
    expect(edited).toHaveLength(1)
    const { error: retireError } = await staff.from("assets").update({ status: "retired" }).eq("id", data!.id)
    expect(retireError?.message).toMatch(/Only admins and managers/)
    const { error: deleteError } = await staff.from("assets").update({ deleted_at: new Date().toISOString() }).eq("id", data!.id)
    expect(deleteError?.message).toMatch(/Only admins can delete/)
  })

  it("viewers cannot insert assets", async () => {
    const { error } = await viewer.from("assets").insert({ name: "RLS test (should fail)", kind: "physical" })
    expect(error?.message).toMatch(/row-level security/)
  })

  it("managers can insert assets, and get an automatic tag", async () => {
    const { data, error } = await manager.from("assets").insert({ name: "RLS test item", kind: "physical" }).select("id, asset_tag").single()
    expect(error).toBeNull()
    expect(data?.asset_tag).toMatch(/^[A-Z0-9]+-\d{4}-\d{6}$/)
  })

  it("staff cannot edit items someone else added (the update silently matches no rows)", async () => {
    const { data } = await staff.from("assets").update({ name: "hacked" }).eq("id", assetId).select("id")
    expect(data ?? []).toHaveLength(0)
  })

  it("nobody can write loans directly; only the check-out function can", async () => {
    const { error } = await staff.from("checkouts").insert({ asset_id: assetId, asset_kind: "physical", borrower_type: "student", borrower_name: "X" })
    expect(error?.message).toMatch(/row-level security/)
  })

  it("viewers cannot check items out", async () => {
    const { error } = await viewer.rpc("check_out_asset", { p_asset_id: assetId, p_borrower_type: "student", p_borrower_name: "Test" })
    expect(error?.message).toMatch(/permission/)
  })

  it("staff cannot read the audit log; managers can", async () => {
    const { data: staffRows } = await staff.from("audit_log").select("id").limit(1)
    expect(staffRows ?? []).toHaveLength(0)
    const { data: managerRows } = await manager.from("audit_log").select("id").limit(1)
    expect(managerRows).toHaveLength(1)
  })

  it("nobody can delete audit history", async () => {
    const { data } = await admin.from("audit_log").delete().not("id", "is", null).select("id")
    expect(data ?? []).toHaveLength(0)
  })

  it("staff cannot promote themselves to admin", async () => {
    const { data: me } = await staff.auth.getUser()
    const { error } = await staff.from("profiles").update({ role: "admin" }).eq("id", me.user!.id)
    expect(error?.message).toMatch(/Only an admin/)
  })

  it("only admins can manage categories", async () => {
    const { error } = await manager.from("categories").insert({ name: "RLS test category", kind: "physical" })
    expect(error?.message).toMatch(/row-level security/)
  })
})
