import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays, format } from "date-fns"

import type { CurrentUser } from "@/lib/auth"
import { straightLineDepreciation } from "@/lib/depreciation"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import {
  annualizedCost,
  BORROWER_TYPE_LABELS,
  CONDITION_LABELS,
  LICENSE_TYPE_LABELS,
  STATUS_LABELS,
  borrowerLabel,
} from "@/lib/labels"
import type { Database } from "@/types/database"

import { REPORT_META, type ReportData, type ReportGroup, type ReportParams, type ReportRow, type ReportSection } from "./definitions"

type Client = SupabaseClient<Database>

/** PostgREST returns at most 1,000 rows per request, so read in pages. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < size) break
    if (from > 50_000) break // safety valve
  }
  return out
}

function fiscalYearLabel(startMonth: number, today = new Date()) {
  const startYear = today.getMonth() + 1 >= startMonth ? today.getFullYear() : today.getFullYear() - 1
  if (startMonth === 1) return `Fiscal year ${startYear}`
  return `Fiscal year ${startYear}–${String(startYear + 1).slice(2)}`
}

function schoolYearStart(startMonth: number, today = new Date()) {
  const startYear = today.getMonth() + 1 >= startMonth ? today.getFullYear() : today.getFullYear() - 1
  return format(new Date(startYear, startMonth - 1, 1), "yyyy-MM-dd")
}

const sum = (rows: ReportRow[], key: string) => rows.reduce((acc, r) => acc + (typeof r[key] === "number" ? (r[key] as number) : 0), 0)
const round2 = (n: number) => Math.round(n * 100) / 100

type Context = {
  supabase: Client
  user: CurrentUser
  params: ReportParams
  institution: { name: string; fiscal_year_start_month: number }
}

/** Builds any report. Everything goes through the user's own client, so RLS still applies. */
export async function buildReport(supabase: Client, user: CurrentUser, params: ReportParams): Promise<ReportData> {
  const { data: settings } = await supabase
    .from("institution_settings")
    .select("name, fiscal_year_start_month")
    .limit(1)
    .maybeSingle()
  const ctx: Context = {
    supabase,
    user,
    params,
    institution: settings ?? { name: "Your school", fiscal_year_start_month: 7 },
  }

  const base = {
    type: params.type,
    title: REPORT_META[params.type].title,
    institution: ctx.institution.name,
    generatedAt: new Date().toISOString(),
    generatedBy: user.fullName,
  }

  switch (params.type) {
    case "annual_inventory":
      return { ...base, ...(await annualInventory(ctx)) }
    case "checkout_activity":
      return { ...base, ...(await checkoutActivity(ctx)) }
    case "valuation":
      return { ...base, ...(await valuation(ctx)) }
    case "license_summary":
      return { ...base, ...(await licenseSummary(ctx)) }
    case "audit_trail":
      return { ...base, ...(await auditTrail(ctx)) }
  }
}

/** buildReport plus how long it took (shown on screen and logged, as the paper measured). */
export async function buildReportTimed(supabase: Client, user: CurrentUser, params: ReportParams) {
  const started = performance.now()
  const data = await buildReport(supabase, user, params)
  return { data, durationMs: Math.round(performance.now() - started) }
}

type Body = Omit<ReportData, "type" | "title" | "institution" | "generatedAt" | "generatedBy">

async function loadAssets(ctx: Context, opts: { physicalOnly?: boolean } = {}) {
  const { supabase, params } = ctx
  const rows = await fetchAll((from, to) => {
    let q = supabase
      .from("assets")
      .select(
        "id, asset_tag, name, kind, status, condition, acquisition_date, acquisition_cost, location_id, category:categories(id, name, useful_life_years, parent_id), location:locations(name)"
      )
      .is("deleted_at", null)
      .order("asset_tag")
      .range(from, to)
    if (params.location_id) q = q.eq("location_id", params.location_id)
    if (opts.physicalOnly) q = q.eq("kind", "physical")
    return q
  })
  // Subcategories inherit the parent's useful life when they don't set one.
  const { data: cats } = await supabase.from("categories").select("id, useful_life_years")
  const lifeById = new Map((cats ?? []).map((c) => [c.id, c.useful_life_years]))
  return rows.map((a) => ({
    ...a,
    usefulLife: a.category?.useful_life_years ?? (a.category?.parent_id ? (lifeById.get(a.category.parent_id) ?? null) : null),
  }))
}

async function scopeLabel(ctx: Context) {
  if (!ctx.params.location_id) return "All locations"
  const { data } = await ctx.supabase.from("locations").select("name").eq("id", ctx.params.location_id).maybeSingle()
  return data?.name ?? "Selected location"
}

// ---------------------------------------------------------------------------
// 1. Annual Inventory: grouped by location, then category.
// ---------------------------------------------------------------------------
async function annualInventory(ctx: Context): Promise<Body> {
  const assets = (await loadAssets(ctx)).filter((a) => a.status !== "retired")
  const today = new Date()

  const byLocation = new Map<string, typeof assets>()
  for (const a of assets) {
    const loc = a.kind === "digital" ? "Digital resources" : (a.location?.name ?? "No location assigned")
    byLocation.set(loc, [...(byLocation.get(loc) ?? []), a])
  }

  const sections: ReportSection[] = [...byLocation.entries()]
    .sort(([a], [b]) => (a === "Digital resources" ? 1 : b === "Digital resources" ? -1 : a.localeCompare(b)))
    .map(([location, items]) => {
      const byCategory = new Map<string, typeof items>()
      for (const a of items) {
        const cat = a.category?.name ?? "Uncategorized"
        byCategory.set(cat, [...(byCategory.get(cat) ?? []), a])
      }
      const groups: ReportGroup[] = [...byCategory.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, list]) => {
          const rows: ReportRow[] = list.map((a) => {
            const dep = straightLineDepreciation({
              cost: a.acquisition_cost,
              acquisitionDate: a.acquisition_date,
              usefulLifeYears: a.usefulLife,
              asOf: today,
            })
            return {
              asset_tag: a.asset_tag,
              name: a.name,
              condition: a.condition ? CONDITION_LABELS[a.condition] : "—",
              status: STATUS_LABELS[a.status],
              acquired: a.acquisition_date,
              cost: a.acquisition_cost,
              book_value: dep ? dep.bookValue : a.acquisition_cost,
            }
          })
          return {
            title: category,
            rows,
            subtotal: { asset_tag: `${list.length} items`, name: `${category} subtotal`, cost: round2(sum(rows, "cost")), book_value: round2(sum(rows, "book_value")) },
          }
        })
      const all = groups.flatMap((g) => g.rows)
      return {
        title: location,
        groups,
        subtotal: { asset_tag: `${items.length} items`, name: `${location} total`, cost: round2(sum(all, "cost")), book_value: round2(sum(all, "book_value")) },
      }
    })

  const allRows = sections.flatMap((s) => s.groups.flatMap((g) => g.rows))
  const conditionCounts = new Map<string, number>()
  for (const a of assets) {
    const key = a.condition ? CONDITION_LABELS[a.condition] : "Not recorded"
    conditionCounts.set(key, (conditionCounts.get(key) ?? 0) + 1)
  }

  return {
    period: fiscalYearLabel(ctx.institution.fiscal_year_start_month),
    scope: await scopeLabel(ctx),
    columns: [
      { key: "asset_tag", label: "Tag", width: 1.3 },
      { key: "name", label: "Item", width: 2.6 },
      { key: "condition", label: "Condition" },
      { key: "status", label: "Status" },
      { key: "acquired", label: "Acquired", format: "date" },
      { key: "cost", label: "Cost", format: "money" },
      { key: "book_value", label: "Book value", format: "money" },
    ],
    sections,
    grandTotal: { asset_tag: `${assets.length} items`, name: "Grand total", cost: round2(sum(allRows, "cost")), book_value: round2(sum(allRows, "book_value")) },
    summary: [
      { label: "Items", value: formatNumber(assets.length) },
      { label: "Locations", value: formatNumber(sections.length) },
      { label: "Original cost", value: formatMoney(sum(allRows, "cost"), { whole: true }) },
      { label: "Current book value", value: formatMoney(sum(allRows, "book_value"), { whole: true }) },
      ...[...conditionCounts.entries()].map(([label, n]) => ({ label: `Condition: ${label}`, value: formatNumber(n) })),
    ],
    notes: [
      "Retired items are excluded. Book value uses straight-line depreciation over each category's useful life; items without enough data show their original cost.",
    ],
    rowCount: allRows.length,
  }
}

// ---------------------------------------------------------------------------
// 2. Checkout Activity: loans in a date range, overdue, lost.
// ---------------------------------------------------------------------------
async function checkoutActivity(ctx: Context): Promise<Body> {
  const { supabase, params, user } = ctx
  const from = params.from ?? schoolYearStart(ctx.institution.fiscal_year_start_month)
  const to = params.to ?? format(new Date(), "yyyy-MM-dd")
  // Staff can only report on their own checkouts (CLAUDE.md §7).
  const ownOnly = user.role === "staff"

  const loans = await fetchAll((start, end) => {
    let q = supabase
      .from("checkouts")
      .select(
        "id, borrower_type, borrower_name, borrower_ref, checked_out_at, due_at, returned_at, condition_in, asset:assets(asset_tag, name, status, kind)"
      )
      .gte("checked_out_at", `${from}T00:00:00`)
      .lte("checked_out_at", `${to}T23:59:59`)
      .order("checked_out_at", { ascending: false })
      .range(start, end)
    if (ownOnly) q = q.eq("checked_out_by", user.id)
    return q
  })

  const now = Date.now()
  const toRow = (c: (typeof loans)[number]): ReportRow => {
    const overdue = !c.returned_at && c.due_at && new Date(c.due_at).getTime() < now
    const state = c.returned_at
      ? "Returned"
      : c.asset?.status === "lost"
        ? "Lost"
        : overdue
          ? "Overdue"
          : "Out"
    return {
      asset_tag: c.asset?.asset_tag ?? "",
      name: c.asset?.name ?? "",
      borrower: borrowerLabel(c.borrower_type, c.borrower_name, c.borrower_ref),
      borrower_type: BORROWER_TYPE_LABELS[c.borrower_type],
      out: c.checked_out_at.slice(0, 10),
      due: c.due_at ? c.due_at.slice(0, 10) : null,
      returned: c.returned_at ? c.returned_at.slice(0, 10) : null,
      condition_in: c.condition_in ? CONDITION_LABELS[c.condition_in] : null,
      state,
    }
  }

  const rows = loans.map(toRow)
  const overdue = rows.filter((r) => r.state === "Overdue")
  const lost = rows.filter((r) => r.state === "Lost")
  const damaged = rows.filter((r) => r.condition_in === "Broken" || r.condition_in === "Poor")

  const sections: ReportSection[] = []
  if (overdue.length) sections.push({ title: `Overdue (${overdue.length})`, groups: [{ rows: overdue }] })
  if (lost.length) sections.push({ title: `Lost while on loan (${lost.length})`, groups: [{ rows: lost }] })
  sections.push({ title: `All loans (${rows.length})`, groups: [{ rows }] })

  return {
    period: `${formatDate(from)} – ${formatDate(to)}`,
    scope: ownOnly ? `Checkouts by ${user.fullName}` : "All staff",
    columns: [
      { key: "asset_tag", label: "Tag", width: 1.3 },
      { key: "name", label: "Item", width: 2 },
      { key: "borrower", label: "Borrower", width: 1.5 },
      { key: "out", label: "Checked out", format: "date" },
      { key: "due", label: "Due", format: "date" },
      { key: "returned", label: "Returned", format: "date" },
      { key: "condition_in", label: "Returned as" },
      { key: "state", label: "Status" },
    ],
    sections,
    summary: [
      { label: "Loans", value: formatNumber(rows.length) },
      { label: "Returned", value: formatNumber(rows.filter((r) => r.state === "Returned").length) },
      { label: "Still out", value: formatNumber(rows.filter((r) => r.state === "Out").length) },
      { label: "Overdue", value: formatNumber(overdue.length) },
      { label: "Lost", value: formatNumber(lost.length) },
      { label: "Returned damaged", value: formatNumber(damaged.length) },
    ],
    notes: ["Students are identified by school ID number only."],
    rowCount: rows.length,
  }
}

// ---------------------------------------------------------------------------
// 3. Valuation & Depreciation: by category.
// ---------------------------------------------------------------------------
async function valuation(ctx: Context): Promise<Body> {
  const assets = (await loadAssets(ctx, { physicalOnly: true })).filter((a) => a.status !== "retired")
  const today = new Date()

  const byCategory = new Map<string, typeof assets>()
  for (const a of assets) {
    const cat = a.category?.name ?? "Uncategorized"
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), a])
  }

  const groups: ReportGroup[] = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]) => {
      const rows = list.map((a) => {
        const dep = straightLineDepreciation({ cost: a.acquisition_cost, acquisitionDate: a.acquisition_date, usefulLifeYears: a.usefulLife, asOf: today })
        return {
          asset_tag: a.asset_tag,
          name: a.name,
          acquired: a.acquisition_date,
          life: a.usefulLife,
          cost: a.acquisition_cost,
          accumulated: dep?.accumulatedDepreciation ?? null,
          book_value: dep?.bookValue ?? a.acquisition_cost,
        } satisfies ReportRow
      })
      return {
        title: category,
        rows,
        subtotal: {
          asset_tag: `${rows.length} items`,
          name: `${category} subtotal`,
          cost: round2(sum(rows, "cost")),
          accumulated: round2(sum(rows, "accumulated")),
          book_value: round2(sum(rows, "book_value")),
        },
      }
    })

  const all = groups.flatMap((g) => g.rows)
  const cost = sum(all, "cost")
  const book = sum(all, "book_value")
  return {
    period: `As of ${formatDate(today)}`,
    scope: await scopeLabel(ctx),
    columns: [
      { key: "asset_tag", label: "Tag", width: 1.3 },
      { key: "name", label: "Item", width: 2.6 },
      { key: "acquired", label: "Acquired", format: "date" },
      { key: "life", label: "Life (yrs)", format: "number" },
      { key: "cost", label: "Cost", format: "money" },
      { key: "accumulated", label: "Depreciation", format: "money" },
      { key: "book_value", label: "Book value", format: "money" },
    ],
    sections: [{ groups }],
    grandTotal: { asset_tag: `${all.length} items`, name: "Grand total", cost: round2(cost), accumulated: round2(sum(all, "accumulated")), book_value: round2(book) },
    summary: [
      { label: "Physical items", value: formatNumber(all.length) },
      { label: "Original cost", value: formatMoney(cost, { whole: true }) },
      { label: "Accumulated depreciation", value: formatMoney(sum(all, "accumulated"), { whole: true }) },
      { label: "Current book value", value: formatMoney(book, { whole: true }) },
      { label: "Value retained", value: cost ? `${Math.round((book / cost) * 100)}%` : "—" },
    ],
    notes: [
      "Straight-line method with no salvage value: cost ÷ useful life per year, counted in whole months since acquisition.",
      "Retired and digital items are excluded.",
    ],
    rowCount: all.length,
  }
}

// ---------------------------------------------------------------------------
// 4. Digital License Summary
// ---------------------------------------------------------------------------
async function licenseSummary(ctx: Context): Promise<Body> {
  const { supabase } = ctx
  const [{ data: assets, error }, seats] = await Promise.all([
    supabase
      .from("assets")
      .select("id, asset_tag, name, status, license:digital_licenses(*)")
      .eq("kind", "digital")
      .is("deleted_at", null)
      .neq("status", "retired")
      .order("name"),
    fetchAll((from, to) =>
      supabase.from("checkouts").select("asset_id").eq("asset_kind", "digital").is("returned_at", null).range(from, to)
    ),
  ])
  if (error) throw new Error(error.message)
  const used = new Map<string, number>()
  for (const s of seats) used.set(s.asset_id, (used.get(s.asset_id) ?? 0) + 1)

  const rows: ReportRow[] = (assets ?? []).map((a) => {
    const l = a.license
    const u = used.get(a.id) ?? 0
    const annual = l ? annualizedCost(l.cost_per_period, l.billing_cycle) : null
    return {
      name: a.name,
      type: l ? LICENSE_TYPE_LABELS[l.license_type] : "—",
      purchased: l?.seats_total ?? null,
      used: u,
      utilization: l?.seats_total ? u / l.seats_total : null,
      annual_cost: annual,
      per_seat: annual != null && u > 0 ? round2(annual / u) : null,
      renewal: l?.renewal_date ?? null,
    }
  })

  const soon = format(addDays(new Date(), 90), "yyyy-MM-dd")
  const today = format(new Date(), "yyyy-MM-dd")
  const upcoming = rows.filter((r) => typeof r.renewal === "string" && r.renewal >= today && r.renewal <= soon)
  const underused = rows.filter((r) => typeof r.utilization === "number" && r.utilization < 0.5)

  const sections: ReportSection[] = [{ title: "All licenses", groups: [{ rows }] }]
  if (upcoming.length) sections.push({ title: `Renewing in the next 90 days (${upcoming.length})`, groups: [{ rows: upcoming }] })
  if (underused.length) sections.push({ title: `Under half of seats used (${underused.length})`, groups: [{ rows: underused }] })

  const annualTotal = sum(rows, "annual_cost")
  const seatsBought = sum(rows, "purchased")
  const seatsUsed = rows.filter((r) => r.purchased !== null).reduce((acc, r) => acc + (r.used as number), 0)
  return {
    period: `As of ${formatDate(new Date())}`,
    scope: "All digital resources",
    columns: [
      { key: "name", label: "License", width: 2.4 },
      { key: "type", label: "Type" },
      { key: "purchased", label: "Seats", format: "number" },
      { key: "used", label: "In use", format: "number" },
      { key: "utilization", label: "Used", format: "percent" },
      { key: "annual_cost", label: "Per year", format: "money" },
      { key: "per_seat", label: "Per used seat", format: "money" },
      { key: "renewal", label: "Renews", format: "date" },
    ],
    sections,
    grandTotal: { name: "Total", purchased: seatsBought, used: sum(rows, "used"), annual_cost: round2(annualTotal) },
    summary: [
      { label: "Licenses", value: formatNumber(rows.length) },
      { label: "Yearly cost", value: formatMoney(annualTotal, { whole: true }) },
      { label: "Seats used / purchased", value: `${formatNumber(seatsUsed)} / ${formatNumber(seatsBought)}` },
      { label: "Renewing in 90 days", value: formatNumber(upcoming.length) },
      { label: "Under half used", value: formatNumber(underused.length) },
    ],
    notes: ["Per-year cost converts monthly and multi-year (3-year) billing to a yearly amount. Site licenses have unlimited seats."],
    rowCount: rows.length,
  }
}

// ---------------------------------------------------------------------------
// 5. Audit Trail (admins and managers; RLS also enforces this)
// ---------------------------------------------------------------------------
async function auditTrail(ctx: Context): Promise<Body> {
  const { supabase, params } = ctx
  const from = params.from ?? format(addDays(new Date(), -30), "yyyy-MM-dd")
  const to = params.to ?? format(new Date(), "yyyy-MM-dd")
  const entries = await fetchAll((start, end) =>
    supabase
      .from("audit_log")
      .select("created_at, action, entity, summary, actor:profiles!audit_log_actor_id_fkey(full_name)")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .range(start, end)
  )
  const rows: ReportRow[] = entries.map((e) => ({
    when: e.created_at.slice(0, 16).replace("T", " "),
    who: e.actor?.full_name ?? "System",
    action: e.action.replaceAll("_", " "),
    summary: e.summary,
  }))
  const byAction = new Map<string, number>()
  for (const r of rows) byAction.set(String(r.action), (byAction.get(String(r.action)) ?? 0) + 1)

  return {
    period: `${formatDate(from)} – ${formatDate(to)}`,
    scope: "All activity",
    columns: [
      { key: "when", label: "When (UTC)", width: 1.3 },
      { key: "who", label: "Who", width: 1.3 },
      { key: "action", label: "Action" },
      { key: "summary", label: "What happened", width: 4 },
    ],
    sections: [{ groups: [{ rows }] }],
    summary: [
      { label: "Entries", value: formatNumber(rows.length) },
      ...[...byAction.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label: label[0].toUpperCase() + label.slice(1), value: formatNumber(n) })),
    ],
    notes: ["The audit log is written by the database itself and cannot be edited or deleted from the app."],
    rowCount: rows.length,
  }
}
