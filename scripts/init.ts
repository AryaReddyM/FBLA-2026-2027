// Prepares a Supabase project for a school:
//
//   npm run setup   (pushes the database schema, then runs this)
//
// Creates or updates the first admin account, sets the school's name, and adds
// starter categories. It never adds or deletes items, so it's safe to run again
// (for example, to reset the admin password).

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const fullName = process.env.ADMIN_NAME?.trim() || email?.split("@")[0] || "School admin"
const schoolName = process.env.SCHOOL_NAME?.trim()

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

if (!url || !serviceKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.")
if (!email || !email.includes("@")) fail("Set ADMIN_EMAIL in .env.local.")
if (!password || password.length < 8) fail("Set ADMIN_PASSWORD (8+ characters) in .env.local.")

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

// Common K-12 categories so registering the first items is quick. Admins can
// rename or delete them in Settings → Categories.
const STARTER_CATEGORIES = [
  { name: "Chromebooks", kind: "physical", useful_life_years: 4, custom_field_schema: [
    { key: "mac_address", label: "MAC address", type: "text", required: false, options: [] },
  ] },
  { name: "Laptops", kind: "physical", useful_life_years: 4, custom_field_schema: [] },
  { name: "Projectors & displays", kind: "physical", useful_life_years: 6, custom_field_schema: [] },
  { name: "Calculators", kind: "physical", useful_life_years: 6, custom_field_schema: [] },
  { name: "Textbooks", kind: "physical", useful_life_years: 6, custom_field_schema: [
    { key: "isbn", label: "ISBN", type: "text", required: false, options: [] },
  ] },
  { name: "Furniture", kind: "physical", useful_life_years: 10, custom_field_schema: [] },
  { name: "Lab equipment", kind: "physical", useful_life_years: 8, custom_field_schema: [] },
  { name: "Software & licenses", kind: "digital", useful_life_years: null, custom_field_schema: [] },
  { name: "Subscriptions & e-books", kind: "digital", useful_life_years: null, custom_field_schema: [] },
]

async function findUserId(target: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`Couldn't list users: ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  console.log(`Setting up EduTrack at ${url}\n`)

  let id = await findUserId(email!)
  if (id) {
    const { error } = await supabase.auth.admin.updateUserById(id, { password, email_confirm: true })
    if (error) fail(`Couldn't update ${email}: ${error.message}`)
    console.log(`  • ${email} already exists, password updated`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error || !data.user) fail(`Couldn't create ${email}: ${error?.message}`)
    id = data.user.id
    console.log(`  • created ${email}`)
  }

  const { error: roleError } = await supabase.from("profiles").update({ role: "admin", is_active: true, full_name: fullName }).eq("id", id)
  if (roleError) fail(`Couldn't make ${email} an admin: ${roleError.message}`)
  console.log("  • made it an admin")

  if (schoolName) {
    const { error } = await supabase.from("institution_settings").update({ name: schoolName }).eq("singleton", true)
    if (error) fail(`Couldn't set the school name: ${error.message}`)
    console.log(`  • school name: ${schoolName}`)
  }

  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true })
  if (!count) {
    const { error } = await supabase.from("categories").insert(STARTER_CATEGORIES)
    if (error) fail(`Couldn't add starter categories: ${error.message}`)
    console.log(`  • added ${STARTER_CATEGORIES.length} starter categories`)
  } else {
    console.log("  • categories already exist, left them alone")
  }

  const { count: items } = await supabase.from("assets").select("id", { count: "exact", head: true })
  console.log(`\n✔ Ready. The inventory has ${items ?? 0} items.`)
  console.log(`  Run "npm run dev" and sign in as ${email}.`)
  console.log("  Next: add your rooms in Settings → Locations, then register items or import a spreadsheet.")
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
