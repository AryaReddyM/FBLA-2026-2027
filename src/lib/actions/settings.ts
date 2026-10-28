"use server"

import { revalidatePath } from "next/cache"

import { fail, friendlyDbError, ok, type ActionResult } from "@/lib/action-result"
import { getCurrentUser } from "@/lib/auth"
import { can } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { fieldErrorsOf, id as idSchema } from "@/lib/validation/common"
import {
  categorySchema,
  createUserSchema,
  institutionSchema,
  locationSchema,
  profileSchema,
  updateUserSchema,
  type CategoryInput,
  type CreateUserInput,
  type InstitutionInput,
  type LocationInput,
  type ProfileInput,
} from "@/lib/validation/settings"

async function requireAdmin() {
  const user = await getCurrentUser()
  return user.role === "admin" ? user : null
}

export async function updateInstitution(input: InstitutionInput): Promise<ActionResult> {
  if (!(await requireAdmin())) return fail("Only admins can change institution settings.")
  const parsed = institutionSchema.safeParse(input)
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.from("institution_settings").update(parsed.data).eq("singleton", true)
  if (error) return fail(friendlyDbError(error))
  revalidatePath("/", "layout")
  return ok()
}

export async function saveCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "settings.catalog")) return fail("Only admins can manage categories.")
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error))
  const { id, ...values } = parsed.data
  if (id && values.parent_id === id) return fail("A category can't be inside itself.", { parent_id: ["Pick a different parent."] })

  const supabase = await createClient()
  const query = id
    ? supabase.from("categories").update(values).eq("id", id).select("id").single()
    : supabase.from("categories").insert(values).select("id").single()
  const { data, error } = await query
  if (error) return fail(friendlyDbError(error), error.code === "23505" ? { name: ["That name is already used."] } : undefined)
  revalidatePath("/settings/categories")
  revalidatePath("/inventory", "layout")
  return ok({ id: data.id })
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user.role, "settings.catalog")) return fail("Only admins can manage categories.")
  if (!idSchema.safeParse(categoryId).success) return fail("Invalid category.")
  const supabase = await createClient()
  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("category_id", categoryId).is("deleted_at", null)
  if (count) return fail(`${count} item${count === 1 ? " uses" : "s use"} this category. Move them to another category first.`)
  const { error } = await supabase.from("categories").delete().eq("id", categoryId)
  if (error) return fail(friendlyDbError(error))
  revalidatePath("/settings/categories")
  return ok()
}

export async function saveLocation(input: LocationInput): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "settings.catalog")) return fail("Only admins can manage locations.")
  const parsed = locationSchema.safeParse(input)
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error))
  const { id, ...values } = parsed.data

  const supabase = await createClient()
  const query = id
    ? supabase.from("locations").update(values).eq("id", id).select("id").single()
    : supabase.from("locations").insert(values).select("id").single()
  const { data, error } = await query
  if (error) return fail(friendlyDbError(error), error.code === "23505" ? { name: ["That name is already used."] } : undefined)
  revalidatePath("/settings/locations")
  revalidatePath("/inventory", "layout")
  return ok({ id: data.id })
}

export async function deleteLocation(locationId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user.role, "settings.catalog")) return fail("Only admins can manage locations.")
  if (!idSchema.safeParse(locationId).success) return fail("Invalid location.")
  const supabase = await createClient()
  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("location_id", locationId).is("deleted_at", null)
  if (count) return fail(`${count} item${count === 1 ? " is" : "s are"} in this location. Move them somewhere else first.`)
  const { error } = await supabase.from("locations").delete().eq("id", locationId)
  if (error) return fail(friendlyDbError(error))
  revalidatePath("/settings/locations")
  return ok()
}

/**
 * Admins create accounts directly (with a starting password), so staff can
 * sign in on any device right away without waiting on a confirmation email.
 * Uses the service-role client because creating auth users needs it; the
 * admin check above is what makes that safe.
 */
export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  if (!(await requireAdmin())) return fail("Only admins can add users.")
  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error))
  const v = parsed.data

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.full_name },
  })
  if (error || !data.user) {
    const exists = error?.code === "email_exists" || error?.message.toLowerCase().includes("already")
    return fail(exists ? "An account with that email already exists." : (error?.message ?? "Couldn't create the account."), exists ? { email: ["Already in use."] } : undefined)
  }
  // The sign-up trigger made the profile as "staff"; apply the chosen role and department.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: v.role, department: v.department, full_name: v.full_name })
    .eq("id", data.user.id)
  if (profileError) return fail(friendlyDbError(profileError))
  revalidatePath("/settings/users")
  return ok()
}

export async function updateUser(input: { id: string; role: string; is_active: boolean }): Promise<ActionResult> {
  const me = await requireAdmin()
  if (!me) return fail("Only admins can change roles.")
  const parsed = updateUserSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid request.")
  if (parsed.data.id === me.id && !parsed.data.is_active) return fail("You can't deactivate your own account.")

  // The user's own client: RLS + the protect_profile_columns trigger re-check
  // that the caller is an admin and that one active admin always remains.
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, is_active: parsed.data.is_active })
    .eq("id", parsed.data.id)
  if (error) return fail(friendlyDbError(error))
  revalidatePath("/settings/users")
  return ok()
}

export async function setUserPassword(userId: string, password: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return fail("Only admins can reset passwords.")
  if (!idSchema.safeParse(userId).success) return fail("Invalid user.")
  if (password.length < 8 || password.length > 72) return fail("Use 8 to 72 characters.")
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return fail(error.message)
  return ok()
}

export async function updateMyProfile(input: ProfileInput): Promise<ActionResult> {
  const user = await getCurrentUser()
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error))
  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id)
  if (error) return fail(friendlyDbError(error))
  revalidatePath("/", "layout")
  return ok()
}
