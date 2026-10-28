import { History } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { z } from "zod"

import { AuditFilters } from "@/components/audit/audit-filters"
import { EmptyState } from "@/components/layout/empty-state"
import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { PaginationNav } from "@/components/layout/pagination-nav"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requirePermission } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database"

export const metadata: Metadata = { title: "Activity log" }

const PAGE_SIZE = 50
const ACTIONS = ["create", "update", "retire", "delete", "check_out", "check_in", "import", "report_generated"] as const

const paramsSchema = z.object({
  action: z.enum(ACTIONS).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export default function AuditPage(props: PageProps<"/audit">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Accountability"
        title="Activity log"
        description="Every change, loan and report, recorded automatically by the database. Entries can't be edited or deleted."
      />
      <Suspense fallback={<Skeleton className="h-[30rem] w-full rounded-xl" />}>
        <AuditLog searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  )
}

function Changes({ changes }: { changes: Json | null }) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null
  const before = (changes.before ?? null) as Record<string, Json> | null
  const after = (changes.after ?? null) as Record<string, Json> | null
  const keys = Object.keys(after ?? before ?? {}).filter(
    (k) => !["id", "created_at", "updated_at", "search_vector", "created_by"].includes(k),
  )
  if (!before || !after || keys.length === 0) return null
  const show = (v: Json | undefined) =>
    v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">What changed</summary>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-muted/60 p-2">
        {keys.map((k) => (
          <div key={k} className="contents">
            <dt className="font-medium">{k.replaceAll("_", " ")}</dt>
            <dd className="break-all">
              <span className="text-danger line-through decoration-1">{show(before[k])}</span> →{" "}
              <span className="text-success">{show(after[k])}</span>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

async function AuditLog({ searchParams }: { searchParams: PageProps<"/audit">["searchParams"] }) {
  await requirePermission("audit.view")
  const params = paramsSchema.parse(await searchParams)
  const page = params.page ?? 1
  const supabase = await createClient()

  let query = supabase
    .from("audit_log")
    .select("id, action, summary, created_at, asset_id, changes, actor:profiles!audit_log_actor_id_fkey(full_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (params.action) query = query.eq("action", params.action)
  // Escape LIKE wildcards in the search text.
  if (params.q) query = query.ilike("summary", `%${params.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00`)
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59`)
  const { data, count } = await query

  return (
    <>
      <AuditFilters values={params} actions={[...ACTIONS]} />
      {!data || data.length === 0 ? (
        <EmptyState icon={History} title="No activity found" description="Try a different filter or date range." />
      ) : (
        <div
          className="overflow-x-auto rounded-xl border bg-card"
          tabIndex={0}
          role="region"
          aria-label="Activity log entries"
        >
          <Table>
            <caption className="sr-only">Audit log entries, newest first</caption>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-48">When</TableHead>
                <TableHead className="w-40">Who</TableHead>
                <TableHead className="w-32">Action</TableHead>
                <TableHead>What happened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                  <TableCell className="text-sm">{e.actor?.full_name ?? "System"}</TableCell>
                  <TableCell>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                      {e.action.replaceAll("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-72 text-sm whitespace-normal">
                    {e.asset_id ? (
                      <Link href={`/inventory/${e.asset_id}`} className="hover:underline">
                        {e.summary}
                      </Link>
                    ) : (
                      e.summary
                    )}
                    <Changes changes={e.changes} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationNav
        path="/audit"
        params={{ action: params.action, q: params.q, from: params.from, to: params.to }}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </>
  )
}
