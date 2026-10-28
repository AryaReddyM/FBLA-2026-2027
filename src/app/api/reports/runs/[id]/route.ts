import { type NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

/** Re-download a past report from Report history. RLS decides whose runs you can see. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/runs/[id]">) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) return NextResponse.redirect(new URL("/login", request.nextUrl.origin))

  const { data: run } = await supabase.from("report_runs").select("file_path").eq("id", id).maybeSingle()
  if (!run?.file_path) return NextResponse.json({ error: "That report file isn't available." }, { status: 404 })

  const fileName = run.file_path.split("/").pop()?.replace(/^\d+-/, "") ?? "report"
  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(run.file_path, 60, { download: fileName })
  if (error || !data) return NextResponse.json({ error: "That report file isn't available." }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
