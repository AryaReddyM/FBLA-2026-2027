import { type NextRequest, NextResponse } from "next/server"

import { toCsv } from "@/lib/csv"
import { CONDITION_LABELS, KIND_LABELS, STATUS_LABELS } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Sign in first." }, { status: 401 })

  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 500)
  if (ids.length === 0) return NextResponse.json({ error: "No items selected." }, { status: 400 })

  // RLS applies: the user only gets rows they're allowed to see.
  const { data, error } = await supabase
    .from("assets")
    .select(
      "asset_tag, name, kind, status, condition, serial_number, manufacturer, model, acquisition_date, acquisition_cost, funding_source, vendor, category:categories(name), location:locations(name)",
    )
    .in("id", ids)
    .is("deleted_at", null)
    .order("asset_tag")
  if (error) return NextResponse.json({ error: "Export failed." }, { status: 500 })

  const csv = toCsv(
    [
      "Asset tag",
      "Name",
      "Kind",
      "Category",
      "Location",
      "Status",
      "Condition",
      "Serial number",
      "Manufacturer",
      "Model",
      "Acquired",
      "Cost",
      "Funding source",
      "Vendor",
    ],
    (data ?? []).map((a) => [
      a.asset_tag,
      a.name,
      KIND_LABELS[a.kind],
      a.category?.name,
      a.location?.name,
      STATUS_LABELS[a.status],
      a.condition ? CONDITION_LABELS[a.condition] : "",
      a.serial_number,
      a.manufacturer,
      a.model,
      a.acquisition_date,
      a.acquisition_cost,
      a.funding_source,
      a.vendor,
    ]),
  )

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="edutrack-items-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
