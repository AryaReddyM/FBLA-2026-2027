"use server"

import { after } from "next/server"
import { z } from "zod"

import { fail, ok, type ActionResult } from "@/lib/action-result"
import { getCurrentUser } from "@/lib/auth"
import { QUICK_SEARCH_LIMIT } from "@/lib/config"
import { createClient } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

export type QuickSearchResult = {
  id: string
  asset_tag: string
  name: string
  kind: Enums<"asset_kind">
  status: Enums<"asset_status">
  location_name: string | null
  category_name: string | null
}

const querySchema = z.string().trim().min(1).max(200)

/** Powers the Ctrl+K command palette. */
export async function quickSearch(
  rawQuery: string
): Promise<ActionResult<{ results: QuickSearchResult[]; total: number }>> {
  await getCurrentUser()
  const parsed = querySchema.safeParse(rawQuery)
  if (!parsed.success) return ok({ results: [], total: 0 })

  const supabase = await createClient()
  const started = performance.now()
  const { data, error } = await supabase.rpc("search_assets", {
    q: parsed.data,
    page: 1,
    page_size: QUICK_SEARCH_LIMIT,
  })
  const durationMs = Math.round(performance.now() - started)
  if (error) return fail("Search isn't available right now.")

  // Logged after the response is sent, so timing never slows the search itself.
  after(async () => {
    await supabase.from("metric_events").insert({ kind: "search", duration_ms: durationMs })
  })

  return ok({
    results: (data ?? []).map((row) => ({
      id: row.id,
      asset_tag: row.asset_tag,
      name: row.name,
      kind: row.kind,
      status: row.status,
      location_name: row.location_name,
      category_name: row.category_name,
    })),
    total: Number(data?.[0]?.total_count ?? 0),
  })
}
