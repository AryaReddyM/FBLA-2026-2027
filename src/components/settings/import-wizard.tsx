"use client"

import { AlertTriangle, CircleCheck, Copy, FileUp, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { findExistingIdentifiers, importAssets, type DuplicateFlags } from "@/lib/actions/import"
import { MAX_IMPORT_ROWS } from "@/lib/config"
import { parseCsv } from "@/lib/csv"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  applyMapping,
  guessMapping,
  IMPORT_FIELDS,
  validateImportRow,
  type ColumnMapping,
  type ImportField,
  type Lookups,
  type RawImportRow,
} from "@/lib/validation/import"

type Step = "upload" | "map" | "preview" | "done"

type PreviewRow = {
  line: number
  raw: RawImportRow
  errors: string[]
  duplicate: string | null
}

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "map", label: "Match columns" },
  { id: "preview", label: "Review" },
  { id: "done", label: "Done" },
]

export function ImportWizard({ lookups }: { lookups: Lookups }) {
  const [step, setStep] = useState<Step>("upload")
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [dupes, setDupes] = useState<DuplicateFlags>({ serials: [], tags: [] })
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ created: number; skipped: number } | null>(null)
  const [pending, startTransition] = useTransition()

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a .csv file. In Excel or Google Sheets, use File → Download / Save as → CSV.")
      return
    }
    const parsed = parseCsv(await file.text())
    if (parsed.length < 2) {
      setError("That file has no data rows under the header row.")
      return
    }
    if (parsed.length - 1 > MAX_IMPORT_ROWS) {
      setError(`That file has ${parsed.length - 1} rows. Import at most ${MAX_IMPORT_ROWS} at a time.`)
      return
    }
    setFileName(file.name)
    setHeaders(parsed[0])
    setRows(parsed.slice(1))
    setMapping(guessMapping(parsed[0]))
    setStep("map")
  }

  const preview: PreviewRow[] = useMemo(() => {
    if (step !== "preview" && step !== "done") return []
    const existingSerials = new Set(dupes.serials.map((s) => s.toLowerCase()))
    const existingTags = new Set(dupes.tags)
    const seenSerials = new Set<string>()
    return rows.map((row, i) => {
      const raw = applyMapping(row, mapping)
      const result = validateImportRow(raw, lookups)
      const serial = raw.serial_number?.trim().toLowerCase()
      const tag = raw.asset_tag?.trim().toUpperCase()
      let duplicate: string | null = null
      if (serial && existingSerials.has(serial)) duplicate = "Serial number already in the catalog"
      else if (tag && existingTags.has(tag)) duplicate = "Asset tag already in the catalog"
      else if (serial && seenSerials.has(serial)) duplicate = "Same serial as an earlier row"
      if (serial) seenSerials.add(serial)
      return { line: i + 2, raw, errors: result.ok ? [] : result.errors, duplicate }
    })
  }, [step, rows, mapping, lookups, dupes])

  const importable = preview.filter((r, i) => r.errors.length === 0 && !r.duplicate && !excluded.has(i))
  const problemCount = preview.filter((r) => r.errors.length > 0 || r.duplicate).length

  function toPreview() {
    if (mapping.name === undefined) {
      setError("Match the Name column before continuing.")
      return
    }
    setError(null)
    startTransition(async () => {
      const raws = rows.map((r) => applyMapping(r, mapping))
      const res = await findExistingIdentifiers(
        raws.map((r) => r.serial_number ?? ""),
        raws.map((r) => r.asset_tag ?? "")
      )
      if (res.ok) setDupes(res.data)
      setExcluded(new Set())
      setStep("preview")
    })
  }

  function runImport() {
    setError(null)
    startTransition(async () => {
      const result = await importAssets(importable.map((r) => r.raw))
      if (result.ok) {
        setSummary({ created: result.data.created, skipped: rows.length - result.data.created })
        setStep("done")
        toast.success(`Imported ${pluralize(result.data.created, "item")}.`)
      } else setError(result.error)
    })
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2" aria-current={s.id === step ? "step" : undefined}>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                i < stepIndex && "border-primary bg-primary text-primary-foreground",
                i === stepIndex && "border-primary text-primary ring-2 ring-primary/30"
              )}
            >
              {i + 1}
            </span>
            <span className={cn(i === stepIndex ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
            {i < STEPS.length - 1 ? <span aria-hidden="true" className="mx-1 h-px w-6 bg-border" /> : null}
          </li>
        ))}
      </ol>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload a spreadsheet</CardTitle>
            <CardDescription>
              Save your existing inventory spreadsheet as CSV. Categories and locations must already exist in Settings.{" "}
              <a href="/import-template.csv" download className="text-primary underline underline-offset-4">
                Download a template
              </a>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="csv-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                onFile(e.dataTransfer.files[0])
              }}
            >
              <FileUp className="size-8 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">Choose a CSV file or drop it here</span>
              <span className="text-sm text-muted-foreground">Up to {MAX_IMPORT_ROWS.toLocaleString()} rows</span>
              <input id="csv-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </CardContent>
        </Card>
      ) : null}

      {step === "map" ? (
        <Card>
          <CardHeader>
            <CardTitle>Match your columns</CardTitle>
            <CardDescription>
              {fileName}: {pluralize(rows.length, "row")}. We guessed the matches below; fix any that are wrong.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`map-${field.key}`}>
                    {field.label} {field.required ? <span className="text-destructive">*</span> : null}
                  </Label>
                  <Select
                    value={mapping[field.key] !== undefined ? String(mapping[field.key]) : "none"}
                    onValueChange={(v) =>
                      setMapping((m) => {
                        const next = { ...m }
                        if (v === "none") delete next[field.key as ImportField]
                        else next[field.key as ImportField] = Number(v)
                        return next
                      })
                    }
                  >
                    <SelectTrigger id={`map-${field.key}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Not in my file —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={toPreview} disabled={pending}>
                {pending ? <Spinner /> : null} Review rows
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "preview" ? (
        <Card>
          <CardHeader>
            <CardTitle>Review before importing</CardTitle>
            <CardDescription>
              {pluralize(importable.length, "row")} ready to import
              {problemCount ? `, ${pluralize(problemCount, "row")} with problems will be skipped` : ""}. Untick any row you
              don&apos;t want. Nothing is saved until you confirm.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[32rem] overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label="Rows to import">
              <Table containerClassName="overflow-visible">
                <caption className="sr-only">Rows from {fileName}</caption>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Include</span>
                    </TableHead>
                    <TableHead className="w-14">Line</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead className="min-w-72">Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r, i) => {
                    const bad = r.errors.length > 0 || !!r.duplicate
                    return (
                      <TableRow key={i} className={cn(bad && "bg-danger-soft/40")}>
                        <TableCell>
                          <Checkbox
                            checked={!bad && !excluded.has(i)}
                            disabled={bad}
                            onCheckedChange={(checked) =>
                              setExcluded((prev) => {
                                const next = new Set(prev)
                                if (checked) next.delete(i)
                                else next.add(i)
                                return next
                              })
                            }
                            aria-label={`Include line ${r.line}`}
                          />
                        </TableCell>
                        <TableCell className="tabular-nums">{r.line}</TableCell>
                        <TableCell className="font-medium">{r.raw.name || "—"}</TableCell>
                        <TableCell>{r.raw.category || "—"}</TableCell>
                        <TableCell>{r.raw.location || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.raw.serial_number || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {r.errors.length ? (
                            <ul className="space-y-0.5 text-danger">
                              {r.errors.map((e) => (
                                <li key={e} className="flex gap-1.5">
                                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                  {e}
                                </li>
                              ))}
                            </ul>
                          ) : r.duplicate ? (
                            <span className="flex gap-1.5 text-warning">
                              <Copy className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> Possible duplicate: {r.duplicate}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-success">
                              <CircleCheck className="size-3.5" aria-hidden="true" /> Ready
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button onClick={runImport} disabled={pending || importable.length === 0}>
                {pending ? <Spinner /> : <Upload aria-hidden="true" />} Import {pluralize(importable.length, "item")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "done" && summary ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Alert className="border-success/30 bg-success-soft text-success">
              <CircleCheck aria-hidden="true" />
              <AlertTitle>Import complete</AlertTitle>
              <AlertDescription className="text-success">
                Created {pluralize(summary.created, "item")}. Skipped {pluralize(summary.skipped, "row")} (problems, duplicates or unticked).
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/inventory?sort=acquisition_date">View the catalog</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload")
                  setRows([])
                  setSummary(null)
                }}
              >
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
