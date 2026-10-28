// @vitest-environment node
//
// Row Level Security tests against the real Supabase database (CLAUDE.md M1).
// They sign in as each demo role with the public key, exactly like a browser
// would, and check that the database itself refuses what the role can't do.
// Skipped automatically when .env.local isn't filled in.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { Database } from "@/types/database"

try {
  process.loadEnvFile(".env.local")
} catch {
  // Variables may come from the environment instead.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const adminPassword = process.env.DEMO_ADMIN_PASSWORD
const userPassword = process.env.DEMO_USER_PASSWORD
const configured = Boolean(url && key && adminPassword && userPassword)

async function signIn(email: string, password: string) {
  const client = createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return client
}

describe.skipIf(!configured)("row level security (live database)", () => {
  let admin: SupabaseClient<Database>
  let manager: SupabaseClient<Database>
  let staff: SupabaseClient<Database>
  let viewer: SupabaseClient<Database>
  let anon: SupabaseClient<Database>
  let assetId: string
  const createdIds: string[] = []

  beforeAll(async () => {
    admin = await signIn("admin@demo.edutrack.test", adminPassword!)
    manager = await signIn("manager@demo.edutrack.test", userPassword!)
    staff = await signIn("teacher@demo.edutrack.test", userPassword!)
    viewer = await signIn("viewer@demo.edutrack.test", userPassword!)
    anon = createClient<Database>(url!, key!, { auth: { persistSession: false } })
    const { data } = await viewer.from("assets").select("id").eq("status", "available").eq("kind", "physical").limit(1).single()
    assetId = data!.id
  }, 30_000)

  afterAll(async () => {
    // Soft-delete anything the test created (assets are never hard-deleted).
    if (createdIds.length) await admin.from("assets").update({ deleted_at: new Date().toISOString() }).in("id", createdIds)
  })

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

  it("staff cannot insert assets", async () => {
    const { error } = await staff.from("assets").insert({ name: "RLS test (should fail)", kind: "physical" })
    expect(error?.message).toMatch(/row-level security/)
  })

  it("viewers cannot insert assets", async () => {
    const { error } = await viewer.from("assets").insert({ name: "RLS test (should fail)", kind: "physical" })
    expect(error?.message).toMatch(/row-level security/)
  })

  it("managers can insert assets, and get an automatic tag", async () => {
    const { data, error } = await manager.from("assets").insert({ name: "RLS test item", kind: "physical" }).select("id, asset_tag").single()
    expect(error).toBeNull()
    expect(data?.asset_tag).toMatch(/^[A-Z0-9]+-\d{4}-\d{6}$/)
    createdIds.push(data!.id)
  })

  it("staff cannot edit assets (the update silently matches no rows)", async () => {
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

  it("only the service role can load demo data", async () => {
    const { error } = await admin.rpc("admin_load_demo_data", { p: {} })
    expect(error?.message).toMatch(/permission denied/)
  })
})
