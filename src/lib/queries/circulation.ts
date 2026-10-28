import "server-only"

import { addDays } from "date-fns"

import { borrowerLabel } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"

export type LoanRow = {
  id: string
  asset_id: string
  asset_tag: string
  asset_name: string
  location: string | null
  borrower: string
  checked_out_at: string
  due_at: string | null
  checked_out_by: string | null
}

/** Every open physical loan, sorted by due date, split into overdue / due this week / later. */
export async function getOpenLoans() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("checkouts")
    .select(
      "id, asset_id, borrower_type, borrower_name, borrower_ref, checked_out_at, due_at, asset:assets(asset_tag, name, location:locations(name)), by:profiles!checkouts_checked_out_by_fkey(full_name)"
    )
    .is("returned_at", null)
    .eq("asset_kind", "physical")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(1000)
  if (error) throw new Error(`Couldn't load loans: ${error.message}`)

  const now = new Date()
  const weekFromNow = addDays(now, 7)
  const rows: LoanRow[] = (data ?? []).map((c) => ({
    id: c.id,
    asset_id: c.asset_id,
    asset_tag: c.asset?.asset_tag ?? "",
    asset_name: c.asset?.name ?? "Unknown item",
    location: c.asset?.location?.name ?? null,
    borrower: borrowerLabel(c.borrower_type, c.borrower_name, c.borrower_ref),
    checked_out_at: c.checked_out_at,
    due_at: c.due_at,
    checked_out_by: c.by?.full_name ?? null,
  }))

  const overdue = rows.filter((r) => r.due_at && new Date(r.due_at) < now)
  const dueThisWeek = rows.filter((r) => r.due_at && new Date(r.due_at) >= now && new Date(r.due_at) <= weekFromNow)
  return { all: rows, overdue, dueThisWeek }
}
