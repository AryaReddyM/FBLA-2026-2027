import { type NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

/**
 * Target of the QR labels: /t/EDU-2026-000412. Scanning a label with any
 * phone camera opens the item's page (after sign-in). Labels encode the tag,
 * not a database id, so they stay meaningful even outside the app.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/t/[tag]">) {
  const { tag } = await ctx.params
  const clean = decodeURIComponent(tag).trim().toUpperCase().slice(0, 64)
  const supabase = await createClient()
  const { data } = await supabase
    .from("assets")
    .select("id")
    .eq("asset_tag", clean)
    .is("deleted_at", null)
    .maybeSingle()
  const target = data ? `/inventory/${data.id}` : `/inventory?q=${encodeURIComponent(clean)}`
  return NextResponse.redirect(new URL(target, request.nextUrl.origin))
}
