"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, friendlyDbError, ok, type ActionResult } from "@/lib/action-result"
import { getCurrentUser } from "@/lib/auth"
import { MAX_IMPORT_ROWS } from "@/lib/config"
import { can } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { IMPORT_FIELDS, validateImportRow, type ImportField, type RawImportRow } from "@/lib/validation/import"

const fieldKeys = IMPORT_FIELDS.map((f) => f.key) as [ImportField, ...ImportField[]]
const rawRowSchema = z.partialRecord(z.enum(fieldKeys), z.string().max(5000))

export type DuplicateFlags = { serials: string[]; tags: string[] }

/** For the preview: which serial numbers and tags already exist in the catalog. */
export async function findExistingIdentifiers(serials: string[], tags: string[]): Promise<ActionResult<DuplicateFlags>> {
  const user = await getCurrentUser()
  if (!can(user.role, "import.run")) return fail("Only admins and managers can import.")
  const supabase = await createClient()
  const clean = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))].slice(0, MAX_IMPORT_ROWS)

  const found: DuplicateFlags = { serials: [], tags: [] }
  const serialList = clean(serials)
  const tagList = clean(tags).map((t) => t.toUpperCase())
  // Chunked so the request URL stays a reasonable length.
  for (let i = 0; i < serialList.length; i += 200) {
    const { data } = await supabase.from("assets").select("serial_number").in("serial_number", serialList.slice(i, i + 200)).is("deleted_at", null)
    found.serials.push(...(data ?? []).map((r) => r.serial_number ?? "").filter(Boolean))
  }
  for (let i = 0; i < tagList.length; i += 200) {
    const { data } = await supabase.from("assets").select("asset_tag").in("asset_tag", tagList.slice(i, i + 200))
    found.tags.push(...(data ?? []).map((r) => r.asset_tag))
  }
  return ok(found)
}

/**
 * Re-validates every row on the server, then imports them all in one
 * transaction (import_assets). Either every row goes in, or none do.
 */
export async function importAssets(rawRows: RawImportRow[]): Promise<ActionResult<{ created: number }>> {
  const user = await getCurrentUser()
  if (!can(user.role, "import.run")) return fail("Only admins and managers can import.")
  const parsed = z.array(rawRowSchema).min(1, "There are no rows to import.").max(MAX_IMPORT_ROWS).safeParse(rawRows)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "The file couldn't be read.")

  const supabase = await createClient()
  const [{ data: categories }, { data: locations }] = await Promise.all([
    supabase.from("categories").select("id, name, kind"),
    supabase.from("locations").select("id, name"),
  ])
  const lookups = { categories: categories ?? [], locations: locations ?? [] }

  const values = []
  for (const [index, row] of parsed.data.entries()) {
    const result = validateImportRow(row, lookups)
    if (!result.ok) return fail(`Row ${index + 1}: ${result.errors[0]}`)
    values.push(result.value)
  }

  const serials = values.map((v) => v.serial_number?.toLowerCase()).filter(Boolean)
  if (new Set(serials).size !== serials.length) return fail("Two rows in the file share the same serial number.")
  const tags = values.map((v) => v.asset_tag).filter(Boolean)
  if (new Set(tags).size !== tags.length) return fail("Two rows in the file share the same asset tag.")

  const { data, error } = await supabase.rpc("import_assets", { p_rows: values })
  if (error) return fail(`Nothing was imported. ${friendlyDbError(error) === "Something went wrong saving that. Please try again." ? error.message : friendlyDbError(error)}`)

  revalidatePath("/inventory")
  revalidatePath("/")
  revalidatePath("/licenses")
  return ok({ created: data ?? values.length })
}
