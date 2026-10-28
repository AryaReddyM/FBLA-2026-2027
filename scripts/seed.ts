// Seeds the demo accounts and the fictional demo school (CLAUDE.md §11).
//
//   npm run db:seed
//
// Runs with plain Node (which understands TypeScript types natively) and
// reads .env.local. Uses the service-role key, so it must never be imported
// by app code.

import { createClient } from "@supabase/supabase-js"

import { generateDemoData } from "../src/lib/demo/generate.ts"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminPassword = process.env.DEMO_ADMIN_PASSWORD
const userPassword = process.env.DEMO_USER_PASSWORD

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

if (!url || !serviceKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.")
// Seeding wipes all inventory data, so it only runs against the demo project.
if (process.env.DEMO_MODE !== "true") {
  fail("This isn't the demo project (DEMO_MODE isn't true), so seeding is blocked to protect real data.")
}
if (!adminPassword || adminPassword.length < 8) fail("Set DEMO_ADMIN_PASSWORD (8+ characters) in .env.local.")
if (!userPassword || userPassword.length < 8) fail("Set DEMO_USER_PASSWORD (8+ characters) in .env.local.")

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

// Mirrors DEMO_ACCOUNTS in src/lib/config.ts. The admin is created first, so
// on a brand-new project it is also the "first user" the database makes admin.
const ACCOUNTS = [
  { key: "admin", email: "admin@demo.edutrack.test", role: "admin", name: "Alex Rivera", department: "Technology", password: adminPassword },
  { key: "manager", email: "manager@demo.edutrack.test", role: "manager", name: "Jordan Patel", department: "Library & Media", password: userPassword },
  { key: "staff", email: "teacher@demo.edutrack.test", role: "staff", name: "Morgan Lee", department: "Mathematics", password: userPassword },
  { key: "viewer", email: "viewer@demo.edutrack.test", role: "viewer", name: "Casey Brooks", department: "Front office", password: userPassword },
] as const

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`Couldn't list users: ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === email)
    if (match) return match.id
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  console.log(`Seeding ${url}\n`)
  const ids: Record<string, string> = {}

  for (const account of ACCOUNTS) {
    let id = await findUserId(account.email)
    if (id) {
      const { error } = await supabase.auth.admin.updateUserById(id, { password: account.password, email_confirm: true })
      if (error) fail(`Couldn't update ${account.email}: ${error.message}`)
      console.log(`  • ${account.email} already exists, password reset`)
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      })
      if (error || !data.user) fail(`Couldn't create ${account.email}: ${error?.message}`)
      id = data.user.id
      console.log(`  • created ${account.email}`)
    }
    ids[account.key] = id
  }

  // Admin first, so there is always an active admin while the others change.
  for (const account of ACCOUNTS) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: account.role, full_name: account.name, department: account.department, is_active: true })
      .eq("id", ids[account.key])
    if (error) fail(`Couldn't set the role for ${account.email}: ${error.message}`)
  }

  const payload = generateDemoData({ admin: ids.admin, manager: ids.manager, staff: ids.staff, viewer: ids.viewer })
  const { data, error } = await supabase.rpc("admin_load_demo_data", { p: payload })
  if (error) fail(`Loading demo data failed: ${error.message}`)

  console.log("\n✔ Demo data loaded:", data)
  console.log("\nSign in with:")
  for (const a of ACCOUNTS) console.log(`  ${a.role.padEnd(8)} ${a.email}  (password from .env.local)`)
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
