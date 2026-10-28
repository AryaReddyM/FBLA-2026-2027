import "server-only"

import { annualizedCost } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

export type LicenseRow = {
  id: string
  asset_tag: string
  name: string
  status: Enums<"asset_status">
  category: string | null
  vendor: string | null
  license_type: Enums<"license_type">
  billing_cycle: Enums<"billing_cycle">
  seats_total: number | null
  seats_used: number
  cost_per_period: number | null
  annual_cost: number | null
  cost_per_used_seat: number | null
  renewal_date: string | null
  expires_at: string | null
}

/** All digital assets with their license terms and how many seats are in use. */
export async function getLicenses(): Promise<LicenseRow[]> {
  const supabase = await createClient()
  const [{ data: assets, error }, { data: seats }] = await Promise.all([
    supabase
      .from("assets")
      .select("id, asset_tag, name, status, vendor, category:categories(name), license:digital_licenses(*)")
      .eq("kind", "digital")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("checkouts").select("asset_id").eq("asset_kind", "digital").is("returned_at", null).limit(100_000),
  ])
  if (error) throw new Error(`Couldn't load licenses: ${error.message}`)

  const used = new Map<string, number>()
  for (const s of seats ?? []) used.set(s.asset_id, (used.get(s.asset_id) ?? 0) + 1)

  return (assets ?? []).map((a) => {
    const l = a.license
    const seatsUsed = used.get(a.id) ?? 0
    const annual = l ? annualizedCost(l.cost_per_period, l.billing_cycle) : null
    return {
      id: a.id,
      asset_tag: a.asset_tag,
      name: a.name,
      status: a.status,
      category: a.category?.name ?? null,
      vendor: a.vendor,
      license_type: l?.license_type ?? "per_seat",
      billing_cycle: l?.billing_cycle ?? "annual",
      seats_total: l?.seats_total ?? null,
      seats_used: seatsUsed,
      cost_per_period: l?.cost_per_period ?? null,
      annual_cost: annual,
      // "Cost per used seat" shows whether a license is worth renewing.
      cost_per_used_seat: annual != null && seatsUsed > 0 ? annual / seatsUsed : null,
      renewal_date: l?.renewal_date ?? null,
      expires_at: l?.expires_at ?? null,
    }
  })
}
