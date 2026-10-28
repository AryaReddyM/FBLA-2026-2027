import "server-only"

import { z } from "zod"

import { CATALOG_PAGE_SIZE } from "@/lib/config"
import { createClient } from "@/lib/supabase/server"
import { Constants, type Enums, type Json } from "@/types/database"

const E = Constants.public.Enums

export const SORT_KEYS = [
  "relevance",
  "asset_tag",
  "name",
  "kind",
  "category",
  "location",
  "status",
  "condition",
  "holder",
  "acquisition_date",
  "acquisition_cost",
] as const
export type SortKey = (typeof SORT_KEYS)[number]

const blankToUndefined = (v: unknown) => (v === "" || v === "all" ? undefined : v)
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)
const param = <T extends z.ZodType>(schema: T) => z.preprocess((v) => blankToUndefined(first(v)), schema.optional().catch(undefined))

/**
 * Catalog filters live in the URL (?q=&status=&page=…) so any view can be
 * bookmarked or shared. Invalid values are ignored rather than erroring.
 */
export const catalogParamsSchema = z.object({
  q: param(z.string().trim().max(200)),
  kind: param(z.enum(E.asset_kind)),
  category: param(z.guid()),
  location: param(z.guid()),
  status: param(z.enum(E.asset_status)),
  condition: param(z.enum(E.asset_condition)),
  year: param(z.coerce.number().int().min(1950).max(2100)),
  funding: param(z.string().max(80)),
  sort: param(z.enum(SORT_KEYS)),
  dir: param(z.enum(["asc", "desc"])),
  page: param(z.coerce.number().int().min(1).max(10_000)),
})

export type CatalogParams = z.infer<typeof catalogParamsSchema>

export function parseCatalogParams(raw: Record<string, string | string[] | undefined>): CatalogParams {
  return catalogParamsSchema.parse(raw)
}

export type CatalogRow = {
  id: string
  asset_tag: string
  name: string
  kind: Enums<"asset_kind">
  status: Enums<"asset_status">
  condition: Enums<"asset_condition"> | null
  category_name: string | null
  location_name: string | null
  model: string | null
  manufacturer: string | null
  serial_number: string | null
  holder: string | null
  due_at: string | null
  seats_total: number | null
  seats_used: number
  acquisition_cost: number | null
  overdue: boolean
}

/**
 * Default direction when the URL doesn't say: newest first for tags, dates
 * and costs (what people usually want to see), A→Z for everything else.
 */
export function defaultSortDir(sort: string): "asc" | "desc" {
  return sort === "asset_tag" || sort === "acquisition_date" || sort === "acquisition_cost" ? "desc" : "asc"
}

export async function searchCatalog(params: CatalogParams, pageSize = CATALOG_PAGE_SIZE) {
  const supabase = await createClient()
  const filters: Record<string, Json> = {}
  if (params.kind) filters.kind = params.kind
  if (params.category) filters.category_id = params.category
  if (params.location) filters.location_id = params.location
  if (params.status) filters.status = params.status
  if (params.condition) filters.condition = params.condition
  if (params.year) filters.year = params.year
  if (params.funding) filters.funding_source = params.funding

  const sort = params.sort ?? (params.q ? "relevance" : "asset_tag")
  const { data, error } = await supabase.rpc("search_assets", {
    q: params.q ?? "",
    filters,
    page: params.page ?? 1,
    page_size: pageSize,
    sort,
    dir: params.dir ?? defaultSortDir(sort),
  })
  if (error) throw new Error(`Catalog search failed: ${error.message}`)

  const now = Date.now()
  const rows: CatalogRow[] = (data ?? []).map((r) => ({
    id: r.id,
    asset_tag: r.asset_tag,
    name: r.name,
    kind: r.kind,
    status: r.status,
    condition: r.condition,
    category_name: r.category_name,
    location_name: r.location_name,
    model: r.model,
    manufacturer: r.manufacturer,
    serial_number: r.serial_number,
    holder: r.holder,
    due_at: r.due_at,
    seats_total: r.seats_total,
    seats_used: r.seats_used ?? 0,
    acquisition_cost: r.acquisition_cost,
    overdue: r.due_at ? new Date(r.due_at).getTime() < now : false,
  }))
  return { rows, total: Number(data?.[0]?.total_count ?? 0), sort, dir: params.dir }
}

/** Distinct funding sources and acquisition years, for the filter dropdowns. */
export async function getCatalogFacets() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("assets")
    .select("funding_source, acquisition_date")
    .is("deleted_at", null)
    .limit(10_000)
  const funding = new Set<string>()
  const years = new Set<number>()
  for (const row of data ?? []) {
    if (row.funding_source) funding.add(row.funding_source)
    if (row.acquisition_date) years.add(Number(row.acquisition_date.slice(0, 4)))
  }
  return {
    fundingSources: [...funding].sort(),
    years: [...years].sort((a, b) => b - a),
  }
}

export async function getAsset(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("assets")
    .select(
      `*,
       category:categories(id, name, kind, useful_life_years, custom_field_schema, parent_id),
       location:locations(id, name, building, room, type),
       license:digital_licenses(*),
       creator:profiles!assets_created_by_fkey(full_name)`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  return data
}

export type AssetDetail = NonNullable<Awaited<ReturnType<typeof getAsset>>>

export async function getAssetByTag(tag: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("assets")
    .select("id")
    .ilike("asset_tag", tag.trim())
    .is("deleted_at", null)
    .maybeSingle()
  return data
}

export async function getOpenCheckouts(assetId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("checkouts")
    .select("*, checked_out_by_profile:profiles!checkouts_checked_out_by_fkey(full_name)")
    .eq("asset_id", assetId)
    .is("returned_at", null)
    .order("checked_out_at", { ascending: false })
  return data ?? []
}

export type OpenCheckout = Awaited<ReturnType<typeof getOpenCheckouts>>[number]

/** Every change and loan for one asset, newest first. */
export async function getAssetTimeline(assetId: string, canViewAudit: boolean) {
  const supabase = await createClient()

  if (canViewAudit) {
    const { data } = await supabase
      .from("audit_log")
      .select("id, action, summary, created_at, changes, actor:profiles!audit_log_actor_id_fkey(full_name)")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false })
      .limit(100)
    return (data ?? []).map((e) => ({
      id: e.id,
      action: e.action,
      summary: e.summary,
      at: e.created_at,
      actor: e.actor?.full_name ?? null,
      changes: e.changes,
    }))
  }

  // Staff and viewers can't read the audit log (§7), so show loan history instead.
  const { data } = await supabase
    .from("checkouts")
    .select(
      "id, asset_kind, borrower_type, borrower_name, borrower_ref, checked_out_at, returned_at, condition_in, by:profiles!checkouts_checked_out_by_fkey(full_name), to:profiles!checkouts_returned_to_fkey(full_name)"
    )
    .eq("asset_id", assetId)
    .order("checked_out_at", { ascending: false })
    .limit(50)

  const events: { id: string; action: string; summary: string; at: string; actor: string | null; changes: Json | null }[] = []
  for (const c of data ?? []) {
    const who = c.borrower_type === "student" ? `Student #${c.borrower_ref || c.borrower_name}` : c.borrower_name
    if (c.returned_at) {
      events.push({
        id: `${c.id}-in`,
        action: "check_in",
        summary: `checked in from ${who}${c.condition_in ? ` (condition: ${c.condition_in})` : ""}`,
        at: c.returned_at,
        actor: c.to?.full_name ?? null,
        changes: null,
      })
    }
    events.push({
      id: `${c.id}-out`,
      action: "check_out",
      summary: `${c.asset_kind === "digital" ? "assigned a seat" : "checked out"} to ${who}`,
      at: c.checked_out_at,
      actor: c.by?.full_name ?? null,
      changes: null,
    })
  }
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

export type TimelineEvent = Awaited<ReturnType<typeof getAssetTimeline>>[number]

export async function getAssetsByIds(ids: string[]) {
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("assets")
    .select("id, asset_tag, name, model, serial_number, location:locations(name)")
    .in("id", ids.slice(0, 500))
    .is("deleted_at", null)
    .order("asset_tag")
  return data ?? []
}
