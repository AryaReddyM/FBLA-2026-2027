"use client"

import {
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, Download, MapPin, Printer, Tags, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { ConditionLabel, KindBadge, OverdueBadge, StatusBadge } from "@/components/inventory/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { bulkUpdateAssets } from "@/lib/actions/assets"
import { formatDate } from "@/lib/format"
import { STATUS_LABELS } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { withQuery } from "@/lib/url"
import type { CatalogFilterValues } from "@/components/inventory/catalog-filters"
import type { CatalogRow } from "@/lib/queries/assets"
import { EDITABLE_STATUSES } from "@/lib/validation/asset"

const features = tableFeatures({ rowSelectionFeature })

type Props = {
  rows: CatalogRow[]
  params: CatalogFilterValues & { page?: number }
  sort: string
  dir: "asc" | "desc"
  canEdit: boolean
  locations: { value: string; label: string }[]
}

function Holder({ row }: { row: CatalogRow }) {
  if (row.kind === "digital") {
    return (
      <span className="text-sm whitespace-nowrap">
        {row.seats_used} / {row.seats_total ?? "∞"} seats
      </span>
    )
  }
  if (!row.holder) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex flex-col gap-1">
      <span className="text-sm">{row.holder}</span>
      {row.overdue ? (
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <OverdueBadge />
          <span className="text-xs text-muted-foreground">was due {formatDate(row.due_at)}</span>
        </span>
      ) : null}
    </span>
  )
}

function SortHeader({
  id,
  label,
  className,
  sort,
  dir,
  href,
}: {
  id: string
  label: string
  className?: string
  sort: string
  dir: "asc" | "desc"
  href: string
}) {
  const active = sort === id
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <Link
        href={href}
        scroll={false}
        className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 font-medium hover:bg-muted"
      >
        {label}
        <Icon className={cn("size-3.5", active ? "text-foreground" : "text-muted-foreground/70")} aria-hidden="true" />
        <span className="sr-only">{active ? `, sorted ${dir === "asc" ? "ascending" : "descending"}` : ", sort"}</span>
      </Link>
    </TableHead>
  )
}

function selectAll(rows: CatalogRow[]): RowSelectionState {
  const next: RowSelectionState = {}
  for (const row of rows) next[row.id] = true
  return next
}

// Table v9 selection maps only hold `true`; unselecting removes the id.
function toggleId(prev: RowSelectionState, id: string, checked: boolean): RowSelectionState {
  const next = { ...prev }
  if (checked) next[id] = true
  else delete next[id]
  return next
}

export function CatalogTable({ rows, params, sort, dir, canEdit, locations }: Props) {
  const router = useRouter()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pending, startTransition] = useTransition()
  const [moveTo, setMoveTo] = useState("")
  const [statusTo, setStatusTo] = useState("")

  const sortHref = (key: string) =>
    withQuery("/inventory", {
      ...params,
      page: undefined,
      sort: key,
      dir: sort === key && dir === "asc" ? "desc" : "asc",
    })

  const columns = useMemo<ColumnDef<typeof features, CatalogRow>[]>(
    () => [
      { id: "asset_tag", header: "Tag", accessorKey: "asset_tag" },
      { id: "name", header: "Name", accessorKey: "name" },
      { id: "kind", header: "Kind", accessorKey: "kind" },
      { id: "category", header: "Category", accessorKey: "category_name" },
      { id: "location", header: "Location", accessorKey: "location_name" },
      { id: "status", header: "Status", accessorKey: "status" },
      { id: "condition", header: "Condition", accessorKey: "condition" },
      { id: "holder", header: "Assigned to", accessorKey: "holder" },
    ],
    [],
  )

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: canEdit,
  })

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const allSelected = rows.length > 0 && rows.every((r) => rowSelection[r.id])
  const someSelected = selectedIds.length > 0 && !allSelected

  function runBulk(action: Parameters<typeof bulkUpdateAssets>[0], doneMessage: (n: number) => string) {
    startTransition(async () => {
      const result = await bulkUpdateAssets(action)
      if (result.ok) {
        toast.success(doneMessage(result.data.count))
        setRowSelection({})
        setMoveTo("")
        setStatusTo("")
        router.refresh()
      } else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-3">
      {canEdit && selectedIds.length > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky top-18 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent p-2.5 shadow-sm"
        >
          <span className="px-1 text-sm font-medium" aria-live="polite">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-1.5">
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger size="sm" className="w-44 bg-background" aria-label="Move selected items to location">
                <MapPin aria-hidden="true" />
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!moveTo || pending}
              onClick={() =>
                runBulk(
                  { action: "move", ids: selectedIds, location_id: moveTo },
                  (n) => `Moved ${n} item${n === 1 ? "" : "s"}.`,
                )
              }
            >
              Move
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={statusTo} onValueChange={setStatusTo}>
              <SelectTrigger size="sm" className="w-40 bg-background" aria-label="Change status of selected items">
                <Tags aria-hidden="true" />
                <SelectValue placeholder="Set status…" />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!statusTo || pending}
              onClick={() =>
                runBulk(
                  { action: "status", ids: selectedIds, status: statusTo as (typeof EDITABLE_STATUSES)[number] },
                  (n) => `Updated ${n} item${n === 1 ? "" : "s"}. Checked-out items were skipped.`,
                )
              }
            >
              Apply
            </Button>
          </div>
          <Button size="sm" variant="outline" className="bg-background" asChild>
            <Link href={`/inventory/labels?ids=${selectedIds.join(",")}`}>
              <Printer aria-hidden="true" /> Print QR labels
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="bg-background" asChild>
            <a href={`/api/export/assets?ids=${selectedIds.join(",")}`} download>
              <Download aria-hidden="true" /> Export CSV
            </a>
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRowSelection({})}>
            <X aria-hidden="true" /> Clear
          </Button>
        </div>
      ) : null}

      {/* Desktop and tablet: a real table. Wide tables scroll inside their own box, never the page. */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table className={cn(pending && "opacity-60 transition-opacity")}>
          <caption className="sr-only">Inventory items. Column headers are links that sort the table.</caption>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {canEdit ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => setRowSelection(checked ? selectAll(rows) : {})}
                    aria-label="Select all items on this page"
                  />
                </TableHead>
              ) : null}
              <SortHeader id="asset_tag" label="Tag" sort={sort} dir={dir} href={sortHref("asset_tag")} />
              <SortHeader id="name" label="Name" sort={sort} dir={dir} href={sortHref("name")} />
              <SortHeader
                id="kind"
                label="Kind"
                className="hidden xl:table-cell"
                sort={sort}
                dir={dir}
                href={sortHref("kind")}
              />
              <SortHeader
                id="category"
                label="Category"
                className="hidden lg:table-cell"
                sort={sort}
                dir={dir}
                href={sortHref("category")}
              />
              <SortHeader id="location" label="Location" sort={sort} dir={dir} href={sortHref("location")} />
              <SortHeader id="status" label="Status" sort={sort} dir={dir} href={sortHref("status")} />
              <SortHeader
                id="condition"
                label="Condition"
                className="hidden xl:table-cell"
                sort={sort}
                dir={dir}
                href={sortHref("condition")}
              />
              <SortHeader id="holder" label="Assigned to" sort={sort} dir={dir} href={sortHref("holder")} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const item = row.original
              return (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {canEdit ? (
                    <TableCell>
                      <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
                        aria-label={`Select ${item.name} (${item.asset_tag})`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-mono text-xs whitespace-nowrap">{item.asset_tag}</TableCell>
                  <TableCell className="max-w-72">
                    <Link
                      href={`/inventory/${item.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                    {item.model || item.manufacturer ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[item.manufacturer, item.model].filter(Boolean).join(" ")}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <KindBadge kind={item.kind} />
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{item.category_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {item.location_name ?? (item.kind === "digital" ? "Online" : "—")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm xl:table-cell">
                    <ConditionLabel condition={item.condition} />
                  </TableCell>
                  <TableCell>
                    <Holder row={item} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Phones: each item becomes a card. */}
      <ul className={cn("grid gap-2 md:hidden", pending && "opacity-60")} aria-label="Inventory items">
        {rows.map((item) => (
          <li key={item.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start gap-3">
              {canEdit ? (
                <Checkbox
                  className="mt-1"
                  checked={!!rowSelection[item.id]}
                  onCheckedChange={(checked) => setRowSelection((prev) => toggleId(prev, item.id, !!checked))}
                  aria-label={`Select ${item.name} (${item.asset_tag})`}
                />
              ) : null}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/inventory/${item.id}`} className="font-medium hover:text-primary hover:underline">
                    {item.name}
                  </Link>
                  <StatusBadge status={item.status} />
                </div>
                <p className="font-mono text-xs text-muted-foreground">{item.asset_tag}</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>{item.location_name ?? (item.kind === "digital" ? "Online" : "—")}</dd>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>{item.category_name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Assigned to</dt>
                  <dd>
                    <Holder row={item} />
                  </dd>
                </dl>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
