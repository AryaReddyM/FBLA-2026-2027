"use server"

import { revalidatePath } from "next/cache"

import { fail, friendlyDbError, ok, type ActionResult } from "@/lib/action-result"
import { getCurrentUser } from "@/lib/auth"
import { borrowerLabel } from "@/lib/labels"
import { can } from "@/lib/permissions"
import { parseScannedCode } from "@/lib/scan"
import { createClient } from "@/lib/supabase/server"
import { checkInSchema, checkOutSchema, lookupSchema, type CheckInInput, type CheckOutInput } from "@/lib/validation/circulation"
import { fieldErrorsOf } from "@/lib/validation/common"
import type { Enums } from "@/types/database"

function revalidateCirculation(assetId: string) {
  revalidatePath("/circulation")
  revalidatePath("/licenses")
  revalidatePath("/inventory")
  revalidatePath(`/inventory/${assetId}`)
  revalidatePath("/")
}

/** Check out a physical item or assign a digital seat (one transaction in check_out_asset). */
export async function checkOut(input: CheckOutInput): Promise<ActionResult<{ checkoutId: string }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "circulation.use")) return fail("Viewers can't check items out.")
  const parsed = checkOutSchema.safeParse(input)
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error))
  const v = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("check_out_asset", {
    p_asset_id: v.asset_id,
    p_borrower_type: v.borrower_type,
    p_borrower_name: v.borrower_name,
    p_borrower_ref: v.borrower_ref ?? undefined,
    p_due_at: v.due_at ?? undefined,
    p_condition_out: v.condition_out ?? undefined,
    p_notes: v.notes ?? undefined,
  })
  if (error) return fail(friendlyDbError(error))
  revalidateCirculation(v.asset_id)
  return ok({ checkoutId: data })
}

export async function checkIn(input: CheckInInput): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user.role, "circulation.use")) return fail("Viewers can't check items in.")
  const parsed = checkInSchema.safeParse(input)
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error))

  const supabase = await createClient()
  const { data: checkout } = await supabase.from("checkouts").select("asset_id").eq("id", parsed.data.checkout_id).maybeSingle()
  if (!checkout) return fail("Loan record not found.")

  const { error } = await supabase.rpc("check_in_asset", {
    p_checkout_id: parsed.data.checkout_id,
    p_condition_in: parsed.data.condition_in,
    p_notes: parsed.data.notes ?? undefined,
  })
  if (error) return fail(friendlyDbError(error))
  revalidateCirculation(checkout.asset_id)
  return ok()
}

export type LookupResult = {
  asset: {
    id: string
    asset_tag: string
    name: string
    kind: Enums<"asset_kind">
    status: Enums<"asset_status">
    condition: Enums<"asset_condition"> | null
    location_name: string | null
    seats_total: number | null
    seats_used: number
  }
  openCheckouts: {
    id: string
    borrower: string
    borrower_type: Enums<"borrower_type">
    checked_out_at: string
    due_at: string | null
  }[]
}

/**
 * The circulation desk's lookup: accepts a typed tag, a scanned QR/barcode,
 * or a search term. Exact tag matches win; otherwise up to 5 suggestions.
 */
export async function lookupAsset(
  input: string
): Promise<ActionResult<{ match: LookupResult | null; suggestions: { id: string; asset_tag: string; name: string; status: Enums<"asset_status"> }[] }>> {
  await getCurrentUser()
  const parsed = lookupSchema.safeParse({ query: input })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Type or scan an asset tag.")

  const code = parseScannedCode(parsed.data.query)
  const supabase = await createClient()

  let assetId: string | null = null
  if (code?.type === "id") assetId = code.value
  else if (code?.type === "tag") {
    const { data } = await supabase.from("assets").select("id").ilike("asset_tag", code.value).is("deleted_at", null).maybeSingle()
    assetId = data?.id ?? null
  }

  if (!assetId) {
    const { data } = await supabase.rpc("search_assets", { q: parsed.data.query, page: 1, page_size: 5 })
    const rows = data ?? []
    // A single strong hit (e.g. exact serial number) is treated as a match.
    if (rows.length === 1 || (rows[0] && rows[0].rank >= 10)) assetId = rows[0].id
    else {
      return ok({
        match: null,
        suggestions: rows.map((r) => ({ id: r.id, asset_tag: r.asset_tag, name: r.name, status: r.status })),
      })
    }
  }

  return ok({ match: await loadLookup(assetId), suggestions: [] })
}

export async function loadLookupById(assetId: string): Promise<ActionResult<LookupResult | null>> {
  await getCurrentUser()
  return ok(await loadLookup(assetId))
}

async function loadLookup(assetId: string): Promise<LookupResult | null> {
  const supabase = await createClient()
  const [{ data: asset }, { data: checkouts }] = await Promise.all([
    supabase
      .from("assets")
      .select("id, asset_tag, name, kind, status, condition, location:locations(name), license:digital_licenses(seats_total)")
      .eq("id", assetId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("checkouts")
      .select("id, borrower_type, borrower_name, borrower_ref, checked_out_at, due_at")
      .eq("asset_id", assetId)
      .is("returned_at", null)
      .order("checked_out_at", { ascending: false }),
  ])
  if (!asset) return null
  const open = checkouts ?? []
  return {
    asset: {
      id: asset.id,
      asset_tag: asset.asset_tag,
      name: asset.name,
      kind: asset.kind,
      status: asset.status,
      condition: asset.condition,
      location_name: asset.location?.name ?? null,
      seats_total: asset.license?.seats_total ?? null,
      seats_used: open.length,
    },
    openCheckouts: open.map((c) => ({
      id: c.id,
      borrower: borrowerLabel(c.borrower_type, c.borrower_name, c.borrower_ref),
      borrower_type: c.borrower_type,
      checked_out_at: c.checked_out_at,
      due_at: c.due_at,
    })),
  }
}
