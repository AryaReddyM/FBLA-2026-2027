"use client"

import { Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { formatDuration } from "@/lib/format"
import type { ReportFormat, ReportType } from "@/lib/reports/definitions"
import { withQuery } from "@/lib/url"

type Props = {
  type: ReportType
  usesLocation: boolean
  usesDates: boolean
  locations: { value: string; label: string }[]
  values: { location_id?: string; from?: string; to?: string }
}

/** Filters for the selected report (kept in the URL) and the export buttons. */
export function ReportControls({ type, usesLocation, usesDates, locations, values }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [location, setLocation] = useState(values.location_id ?? "all")
  const [from, setFrom] = useState(values.from ?? "")
  const [to, setTo] = useState(values.to ?? "")
  const [exporting, setExporting] = useState<ReportFormat | null>(null)

  const query = {
    type,
    location_id: usesLocation && location !== "all" ? location : undefined,
    from: usesDates ? from || undefined : undefined,
    to: usesDates ? to || undefined : undefined,
  }

  function preview() {
    startTransition(() => router.replace(withQuery("/reports", query), { scroll: false }))
  }

  async function exportAs(format: ReportFormat) {
    setExporting(format)
    try {
      const res = await fetch(
        withQuery(`/api/reports/${type}`, { location_id: query.location_id, from: query.from, to: query.to, format })
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "The report couldn't be generated.")
      }
      const blob = await res.blob()
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `report.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      const ms = Number(res.headers.get("X-Generation-Ms"))
      toast.success(`${format.toUpperCase()} ready${ms ? ` in ${formatDuration(ms)}` : ""}.`)
      router.refresh() // updates Report history
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The report couldn't be generated.")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 lg:flex-row lg:items-end lg:justify-between">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          preview()
        }}
      >
        {usesLocation ? (
          <div className="space-y-1">
            <Label htmlFor="report-location">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger id="report-location" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {usesDates ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="report-from">From</Label>
              <Input id="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-to">To</Label>
              <Input id="report-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-44" />
            </div>
          </>
        ) : null}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? <Spinner /> : <RefreshCw aria-hidden="true" />} Update preview
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Export">
        <span className="text-sm text-muted-foreground">Export:</span>
        {(
          [
            ["pdf", "PDF", FileText],
            ["xlsx", "Excel", FileSpreadsheet],
            ["csv", "CSV", Download],
          ] as const
        ).map(([format, label, Icon]) => (
          <Button key={format} variant="outline" disabled={exporting !== null} onClick={() => exportAs(format)}>
            {exporting === format ? <Spinner /> : <Icon aria-hidden="true" />} {label}
          </Button>
        ))}
      </div>
    </div>
  )
}
