"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, friendlyDbError, ok, type ActionResult } from "@/lib/action-result"
import { getCurrentUser } from "@/lib/auth"
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/config"
import { can } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import {
  assetFormSchema,
  assetStatusChangeSchema,
  bulkActionSchema,
  duplicateCheckSchema,
  type AssetFormInput,
  type BulkAction,
} from "@/lib/validation/asset"
import { fieldErrorsOf, id as idSchema } from "@/lib/validation/common"
import { parseCustomFieldSchema, validateCustomFields } from "@/lib/validation/custom-fields"

function revalidateInventory(assetId?: string) {
  revalidatePath("/inventory")
  revalidatePath("/")
  revalidatePath("/licenses")
  if (assetId) revalidatePath(`/inventory/${assetId}`)
}

export async function getNextAssetTag(): Promise<string | null> {
  await getCurrentUser()
  const supabase = await createClient()
  const { data } = await supabase.rpc("next_asset_tag")
  return data ?? null
}

export type DuplicateMatch = {
  id: string
  asset_tag: string
  name: string
  model: string | null
  serial_number: string | null
  reason: "serial" | "similar"
}

/** Checked before saving: same serial number, or a very similar name + model. */
export async function findDuplicates(input: z.input<typeof duplicateCheckSchema>): Promise<ActionResult<DuplicateMatch[]>> {
  await getCurrentUser()
  const parsed = duplicateCheckSchema.safeParse(input)
  if (!parsed.success) return ok([])
  const { serial_number, name, model, exclude_id } = parsed.data
  if (!serial_number && !name) return ok([])

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("find_possible_duplicates", {
    p_serial: serial_number || undefined,
    p_name: name || undefined,
    p_model: model || undefined,
    p_exclude_id: exclude_id || undefined,
  })
  if (error) return ok([])
  return ok(
    (data ?? []).map((d) => ({
      id: d.id,
      asset_tag: d.asset_tag,
      name: d.name,
      model: d.model,
      serial_number: d.serial_number,
      reason: d.reason === "serial" ? "serial" : "similar",
    }))
  )
}

/**
 * Create (id = null) or update an asset. Validates with the same Zod schema
 * the form uses, checks category custom fields, then saves through the
 * save_asset RPC so the asset and its license details commit together.
 */
export async function saveAsset(
  assetId: string | null,
  input: AssetFormInput,
  meta?: { formDurationMs?: number }
): Promise<ActionResult<{ id: string; asset_tag: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "assets.write")) return fail("Only admins and managers can register or edit items.")
  if (assetId !== null && !idSchema.safeParse(assetId).success) return fail("Invalid item.")

  const parsed = assetFormSchema.safeParse(input)
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error))
  const v = parsed.data

  const supabase = await createClient()

  // Custom fields come from the chosen category's definitions.
  let customFields: Record<string, string | number | null> = {}
  if (v.category_id) {
    const { data: category } = await supabase
      .from("categories")
      .select("kind, custom_field_schema")
      .eq("id", v.category_id)
      .maybeSingle()
    if (!category) return fail("That category no longer exists.", { category_id: ["Pick a category from the list."] })
    if (assetId === null && category.kind !== v.kind) {
      return fail("That category is for a different kind of item.", {
        category_id: [`Pick a ${v.kind} category.`],
      })
    }
    const checked = validateCustomFields(parseCustomFieldSchema(category.custom_field_schema), v.custom_fields)
    if (!checked.ok) {
      return fail(
        "Please fix the highlighted fields.",
        Object.fromEntries(Object.entries(checked.errors).map(([k, m]) => [`custom_fields.${k}`, [m]]))
      )
    }
    customFields = checked.values
  }

  // Only admins can retag an existing item; anyone registering may supply an
  // existing barcode as the tag (blank = auto-generate).
  const assetTag = assetId !== null && user.role !== "admin" ? "" : v.asset_tag

  const asset = {
    asset_tag: assetTag,
    name: v.name,
    description: v.description,
    kind: v.kind,
    category_id: v.category_id,
    location_id: v.location_id,
    status: v.status,
    condition: v.condition,
    serial_number: v.serial_number,
    manufacturer: v.manufacturer,
    model: v.model,
    acquisition_date: v.acquisition_date,
    acquisition_cost: v.acquisition_cost,
    funding_source: v.funding_source,
    vendor: v.vendor,
    notes: v.notes,
    custom_fields: customFields,
  }
  const license =
    v.kind === "digital"
      ? {
          seats_total: v.license_type === "site" ? null : v.seats_total,
          license_type: v.license_type,
          billing_cycle: v.billing_cycle,
          cost_per_period: v.cost_per_period,
          renewal_date: v.renewal_date,
          expires_at: v.expires_at,
          platform_url: v.platform_url,
          admin_contact: v.admin_contact,
          contract_number: v.contract_number,
          license_key_hint: v.license_key_hint,
        }
      : null

  const { data, error } = await supabase.rpc("save_asset", {
    // null means "create a new item". The generated types can't express a
    // nullable SQL argument, so they say string; the function accepts null.
    p_id: assetId as string,
    p_asset: asset,
    p_license: license,
  })
  if (error || !data?.[0]) {
    const message = error ? friendlyDbError(error) : "Couldn't save the item."
    const fieldErrors: Record<string, string[]> = {}
    if (error?.code === "23505" && error.message.includes("serial")) fieldErrors.serial_number = [message]
    if (error?.code === "23505" && error.message.includes("asset_tag")) fieldErrors.asset_tag = [message]
    return fail(message, fieldErrors)
  }

  // Registration timing for the efficiency ("Impact") card.
  if (assetId === null && meta?.formDurationMs && meta.formDurationMs > 0 && meta.formDurationMs < 3_600_000) {
    await supabase.from("metric_events").insert({ kind: "registration", duration_ms: Math.round(meta.formDurationMs) })
  }

  revalidateInventory(data[0].id)
  return ok({ id: data[0].id, asset_tag: data[0].asset_tag })
}

/** Retire, mark lost, send to repair, or mark available again. */
export async function changeAssetStatus(input: z.input<typeof assetStatusChangeSchema>): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user.role, "assets.retire")) return fail("You don't have permission to change an item's status.")
  const parsed = assetStatusChangeSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid request.")

  const supabase = await createClient()
  const { data: current } = await supabase.from("assets").select("status, notes").eq("id", parsed.data.id).maybeSingle()
  if (!current) return fail("Item not found.")
  if (current.status === "checked_out" && parsed.data.status === "retired") {
    return fail("Check this item in before retiring it.")
  }

  const note = parsed.data.note
    ? [current.notes, `${new Date().toISOString().slice(0, 10)}: ${parsed.data.note}`].filter(Boolean).join("\n")
    : current.notes
  const { error } = await supabase
    .from("assets")
    .update({ status: parsed.data.status, notes: note })
    .eq("id", parsed.data.id)
  if (error) return fail(friendlyDbError(error))
  revalidateInventory(parsed.data.id)
  return ok()
}

export async function moveAsset(assetId: string, locationId: string): Promise<ActionResult> {
  return bulkUpdateAssets({ action: "move", ids: [assetId], location_id: locationId }).then((r) =>
    r.ok ? ok() : r
  )
}

/** Catalog bulk actions: move many items to a location, or change their status. */
export async function bulkUpdateAssets(input: BulkAction): Promise<ActionResult<{ count: number }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "assets.write")) return fail("Only admins and managers can update items.")
  const parsed = bulkActionSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.")

  const supabase = await createClient()
  const action = parsed.data
  let query
  if (action.action === "move") {
    query = supabase.from("assets").update({ location_id: action.location_id }).in("id", action.ids).is("deleted_at", null)
  } else {
    // Items that are out on loan keep "checked out" until they're checked in.
    query = supabase
      .from("assets")
      .update({ status: action.status })
      .in("id", action.ids)
      .is("deleted_at", null)
      .neq("status", "checked_out")
  }
  const { data, error } = await query.select("id")
  if (error) return fail(friendlyDbError(error))
  revalidateInventory()
  return ok({ count: data?.length ?? 0 })
}

/** Soft delete (admins only): the row stays for history and old reports. */
export async function deleteAsset(assetId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (user.role !== "admin") return fail("Only admins can delete items. Managers can retire them instead.")
  if (!idSchema.safeParse(assetId).success) return fail("Invalid item.")
  const supabase = await createClient()
  const { data: open } = await supabase.from("checkouts").select("id").eq("asset_id", assetId).is("returned_at", null).limit(1)
  if (open && open.length > 0) return fail("Check this item in (or release its seats) before deleting it.")
  const { error } = await supabase.from("assets").update({ deleted_at: new Date().toISOString() }).eq("id", assetId)
  if (error) return fail(friendlyDbError(error))
  revalidateInventory()
  return ok()
}

// --- Photos -----------------------------------------------------------------

/** Checks the file's first bytes, not just its claimed type, so a renamed file can't sneak through. */
function sniffImageType(bytes: Uint8Array): (typeof ALLOWED_PHOTO_TYPES)[number] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  const riff = String.fromCharCode(...bytes.slice(0, 4))
  const webp = String.fromCharCode(...bytes.slice(8, 12))
  if (riff === "RIFF" && webp === "WEBP") return "image/webp"
  return null
}

export async function uploadAssetPhoto(assetId: string, formData: FormData): Promise<ActionResult<{ path: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "assets.write")) return fail("Only admins and managers can change photos.")
  if (!idSchema.safeParse(assetId).success) return fail("Invalid item.")

  const file = formData.get("photo")
  if (!(file instanceof File)) return fail("Choose a photo to upload.")
  if (file.size > MAX_PHOTO_BYTES) return fail("Photos must be 2 MB or smaller.")
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffImageType(bytes)
  if (!type || !(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return fail("Photos must be JPEG, PNG or WebP images.")
  }

  const supabase = await createClient()
  const { data: asset } = await supabase.from("assets").select("image_path").eq("id", assetId).maybeSingle()
  if (!asset) return fail("Item not found.")

  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"
  const path = `${assetId}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from("asset-photos").upload(path, bytes, {
    contentType: type,
    upsert: false,
  })
  if (uploadError) return fail("The photo couldn't be uploaded. Please try again.")

  const { error } = await supabase.from("assets").update({ image_path: path }).eq("id", assetId)
  if (error) return fail(friendlyDbError(error))
  if (asset.image_path) await supabase.storage.from("asset-photos").remove([asset.image_path])

  revalidateInventory(assetId)
  return ok({ path })
}

export async function removeAssetPhoto(assetId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user.role, "assets.write")) return fail("Only admins and managers can change photos.")
  const supabase = await createClient()
  const { data: asset } = await supabase.from("assets").select("image_path").eq("id", assetId).maybeSingle()
  if (!asset?.image_path) return ok()
  await supabase.storage.from("asset-photos").remove([asset.image_path])
  const { error } = await supabase.from("assets").update({ image_path: null }).eq("id", assetId)
  if (error) return fail(friendlyDbError(error))
  revalidateInventory(assetId)
  return ok()
}
