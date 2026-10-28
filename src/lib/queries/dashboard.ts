import "server-only"

import { addDays, format } from "date-fns"
import { z } from "zod"

import { borrowerLabel } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"
import { Constants } from "@/types/database"

// The RPC returns JSON; parsing it with Zod gives us real types and guards
// against the shape drifting from the SQL.
const statsSchema = z.object({
  total_assets: z.number(),
  physical_assets: z.number(),
  digital_assets: z.number(),
  checked_out: z.number(),
  seats_assigned: z.number(),
  overdue: z.number(),
  licenses_expiring_30: z.number(),
  total_value: z.coerce.number(),
  school_year_start: z.string(),
  by_category: z.array(z.object({ name: z.string(), count: z.number() })),
  by_year: z.array(z.object({ year: z.number(), count: z.number(), value: z.coerce.number() })),
  by_status: z.array(z.object({ status: z.enum(Constants.public.Enums.asset_status), count: z.number() })),
  checkouts_by_month: z.array(z.object({ month: z.string(), count: z.number() })).nullable(),
})

export type DashboardStats = z.infer<typeof statsSchema>

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_stats")
  if (error) throw new Error(`Dashboard stats failed: ${error.message}`)
  return statsSchema.parse(data)
}

/** Last N audit entries in plain language (admins and managers only, by RLS). */
export async function getRecentActivity(limit = 10) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, summary, created_at, asset_id, actor:profiles!audit_log_actor_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map((e) => ({
    id: e.id,
    action: e.action,
    summary: e.summary,
    at: e.created_at,
    actor: e.actor?.full_name ?? null,
    asset_id: e.asset_id,
  }))
}

/** For staff, whose role can't read the audit log: their own recent loans. */
export async function getMyRecentCheckouts(userId: string, limit = 10) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("checkouts")
    .select("id, asset_id, asset_kind, borrower_type, borrower_name, borrower_ref, checked_out_at, returned_at, asset:assets(name, asset_tag)")
    .eq("checked_out_by", userId)
    .order("checked_out_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map((c) => ({
    id: c.id,
    action: c.returned_at ? "check_in" : "check_out",
    summary: `${c.returned_at ? "lent (now returned)" : c.asset_kind === "digital" ? "assigned a seat of" : "checked out"} ${c.asset?.name ?? "an item"} ${c.asset?.asset_tag ?? ""} to ${borrowerLabel(c.borrower_type, c.borrower_name, c.borrower_ref)}`,
    at: c.returned_at ?? c.checked_out_at,
    actor: "You",
    asset_id: c.asset_id,
  }))
}

/** Licenses renewing within 60 days (the dashboard warns at 60 and again at 30). */
export async function getRenewalAlerts() {
  const supabase = await createClient()
  const today = new Date()
  const { data } = await supabase
    .from("digital_licenses")
    .select("asset_id, renewal_date, cost_per_period, asset:assets!inner(name, status, deleted_at)")
    .gte("renewal_date", format(today, "yyyy-MM-dd"))
    .lte("renewal_date", format(addDays(today, 60), "yyyy-MM-dd"))
    .is("asset.deleted_at", null)
    .neq("asset.status", "retired")
    .order("renewal_date")
  return (data ?? []).map((l) => ({
    asset_id: l.asset_id,
    name: l.asset.name,
    renewal_date: l.renewal_date as string,
    cost: l.cost_per_period,
  }))
}

/**
 * The research paper measured how long searching, registering and reporting
 * took. We log the same three timings so the team can show measured results.
 */
export async function getImpactMetrics() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("metric_events")
    .select("kind, duration_ms")
    .order("created_at", { ascending: false })
    .limit(2000)
  const groups = { search: [] as number[], registration: [] as number[], report: [] as number[] }
  for (const m of data ?? []) {
    if (m.kind in groups) groups[m.kind as keyof typeof groups].push(m.duration_ms)
  }
  // Median rather than mean: one person leaving a form open over lunch shouldn't skew it.
  const median = (xs: number[]) => {
    if (xs.length === 0) return null
    const s = [...xs].sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  }
  return {
    search: { median: median(groups.search), count: groups.search.length },
    registration: { median: median(groups.registration), count: groups.registration.length },
    report: { median: median(groups.report), count: groups.report.length },
  }
}
