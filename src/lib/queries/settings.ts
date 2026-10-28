import "server-only"

import { cache } from "react"

import { DEFAULT_LOAN_DAYS, DEFAULT_TAG_PREFIX } from "@/lib/config"
import { createClient } from "@/lib/supabase/server"
import { parseCustomFieldSchema, type CustomFieldDefinition } from "@/lib/validation/custom-fields"
import type { Tables } from "@/types/database"

export type Institution = Pick<
  Tables<"institution_settings">,
  "name" | "asset_tag_prefix" | "default_loan_days" | "fiscal_year_start_month"
>

export const getInstitution = cache(async (): Promise<Institution> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("institution_settings")
    .select("name, asset_tag_prefix, default_loan_days, fiscal_year_start_month")
    .limit(1)
    .maybeSingle()
  return (
    data ?? {
      name: "Your school",
      asset_tag_prefix: DEFAULT_TAG_PREFIX,
      default_loan_days: DEFAULT_LOAN_DAYS,
      fiscal_year_start_month: 7,
    }
  )
})

export type CategoryOption = {
  id: string
  name: string
  kind: Tables<"categories">["kind"]
  parent_id: string | null
  /** Effective useful life: its own, or inherited from the parent category. */
  useful_life_years: number | null
  /** Only what this category itself sets (for the edit form). */
  own_useful_life_years: number | null
  custom_fields: CustomFieldDefinition[]
  /** "Technology › Chromebooks" */
  label: string
}

export const getCategories = cache(async (): Promise<CategoryOption[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("categories")
    .select("id, name, kind, parent_id, useful_life_years, custom_field_schema")
    .order("name")
  const rows = data ?? []
  const byId = new Map(rows.map((r) => [r.id, r]))
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      parent_id: r.parent_id,
      useful_life_years: r.useful_life_years ?? (r.parent_id ? byId.get(r.parent_id)?.useful_life_years ?? null : null),
      own_useful_life_years: r.useful_life_years,
      custom_fields: parseCustomFieldSchema(r.custom_field_schema),
      label: r.parent_id && byId.get(r.parent_id) ? `${byId.get(r.parent_id)!.name} › ${r.name}` : r.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

export type LocationOption = Pick<Tables<"locations">, "id" | "name" | "building" | "room" | "type" | "manager_id">

export const getLocations = cache(async (): Promise<LocationOption[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("locations")
    .select("id, name, building, room, type, manager_id")
    .order("name")
  return data ?? []
})

export const getProfiles = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department, is_active, created_at")
    .order("full_name")
  return data ?? []
})
