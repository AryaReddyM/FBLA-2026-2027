"use client"

import { ArrowDownLeft, ArrowUpRight, CircleCheckBig, KeyRound, Laptop, MapPin, ScanLine, Search, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { CheckInForm } from "@/components/circulation/check-in-form"
import { CheckOutForm } from "@/components/circulation/check-out-form"
import { StatusBadge } from "@/components/inventory/status-badge"
import { ScannerDialog } from "@/components/scanner/scanner-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { loadLookupById, lookupAsset, type LookupResult } from "@/lib/actions/circulation"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"

type Mode = "out" | "in"
type Suggestion = { id: string; asset_tag: string; name: string; status: Enums<"asset_status"> }

type Props = {
  defaultLoanDays: number
  initialAssetId?: string
  initialMode?: Mode
  autoScan?: boolean
}

/**
 * The check-out / check-in station. Built for speed at a busy library desk:
 * the input keeps focus, Enter looks up the tag, a USB barcode scanner
 * (which "types" the code and presses Enter) works with no setup, and a
 * tablet can use its camera instead.
 */
export function CirculationDesk({ defaultLoanDays, initialAssetId, initialMode = "out", autoScan }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<LookupResult | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [lastDone, setLastDone] = useState<string | null>(null)
  const [scanning, setScanning] = useState(Boolean(autoScan))
  const [checkinId, setCheckinId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function show(found: LookupResult | null) {
    setResult(found)
    setCheckinId(found?.openCheckouts[0]?.id ?? null)
    if (found) {
      if (found.asset.kind === "physical") setMode(found.asset.status === "checked_out" ? "in" : "out")
    }
  }

  useEffect(() => {
    if (!initialAssetId) return
    let cancelled = false
    loadLookupById(initialAssetId).then((res) => {
      if (cancelled || !res.ok) return
      show(res.data)
      if (res.data) setMode(initialMode)
    })
    return () => {
      cancelled = true
    }
    // Only on first load with a preselected item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAssetId])

  function lookup(text: string) {
    const value = text.trim()
    if (!value) return
    setMessage(null)
    setLastDone(null)
    setSuggestions([])
    startTransition(async () => {
      const res = await lookupAsset(value)
      if (!res.ok) {
        setMessage(res.error)
        show(null)
        return
      }
      if (res.data.match) {
        show(res.data.match)
        setQuery("")
      } else {
        show(null)
        setSuggestions(res.data.suggestions)
        if (res.data.suggestions.length === 0) setMessage(`Nothing matches “${value}”. Check the tag and try again.`)
      }
    })
  }

  function pick(id: string) {
    setSuggestions([])
    startTransition(async () => {
      const res = await loadLookupById(id)
      if (res.ok) show(res.data)
    })
  }

  function finished(text: string) {
    setLastDone(text)
    setResult(null)
    setQuery("")
    router.refresh()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function clear() {
    setResult(null)
    setSuggestions([])
    setMessage(null)
    setQuery("")
    inputRef.current?.focus()
  }

  const asset = result?.asset
  const physical = asset?.kind === "physical"
  const seatsFull = asset && !physical && asset.seats_total !== null && asset.seats_used >= asset.seats_total
  const selectedLoan = result?.openCheckouts.find((c) => c.id === checkinId) ?? null

  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-muted/40 p-4 sm:p-6">
        <ToggleGroup
          type="single"
          variant="outline"
          value={mode}
          onValueChange={(v) => v && setMode(v as Mode)}
          aria-label="Desk mode"
          className="grid w-full grid-cols-2 bg-background sm:w-96"
        >
          <ToggleGroupItem value="out" className="h-12 gap-2 text-base data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <ArrowUpRight aria-hidden="true" /> Check out
          </ToggleGroupItem>
          <ToggleGroupItem value="in" className="h-12 gap-2 text-base data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <ArrowDownLeft aria-hidden="true" /> Check in
          </ToggleGroupItem>
        </ToggleGroup>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            lookup(query)
          }}
        >
          <Label htmlFor="desk-lookup" className="mb-2 block text-sm font-medium">
            Scan or type an asset tag
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                ref={inputRef}
                id="desk-lookup"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="EDU-2026-000412, serial number, or item name"
                className="h-12 bg-background pl-10 font-mono text-base md:text-base"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="lg" className="h-12 flex-1 px-5" disabled={pending || !query.trim()}>
                {pending ? <Spinner /> : null} Look up
              </Button>
              <Button type="button" variant="outline" size="lg" className="h-12 px-4" onClick={() => setScanning(true)}>
                <ScanLine aria-hidden="true" /> <span className="sm:sr-only md:not-sr-only">Scan</span>
              </Button>
            </div>
          </div>
        </form>
      </div>

      <CardContent className="p-4 sm:p-6" aria-live="polite">
        {lastDone ? (
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-soft p-4 text-success">
            <CircleCheckBig className="size-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{lastDone}</p>
              <p className="text-sm">Ready for the next item.</p>
            </div>
          </div>
        ) : null}

        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {suggestions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Did you mean one of these?</p>
            <ul className="divide-y rounded-lg border">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(s.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{s.asset_tag}</span>
                    </span>
                    <StatusBadge status={s.status} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {asset ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {physical ? <Laptop aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                </span>
                <div className="min-w-0 space-y-1">
                  <Link href={`/inventory/${asset.id}`} className="text-lg font-semibold hover:underline">
                    {asset.name}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-mono text-foreground">{asset.asset_tag}</span>
                    {asset.location_name ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {asset.location_name}
                      </span>
                    ) : null}
                    {!physical ? (
                      <span>
                        {asset.seats_used} / {asset.seats_total ?? "∞"} seats in use
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={asset.status} />
                <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Clear and look up another item">
                  <X aria-hidden="true" />
                </Button>
              </div>
            </div>

            {mode === "out" ? (
              physical && asset.status !== "available" ? (
                <Alert>
                  <AlertDescription>
                    {asset.status === "checked_out" ? (
                      <>
                        This item is already checked out to <strong>{result?.openCheckouts[0]?.borrower}</strong>
                        {result?.openCheckouts[0]?.due_at ? ` (due ${formatDate(result.openCheckouts[0].due_at)})` : ""}.{" "}
                        <button type="button" className="font-medium text-primary underline underline-offset-4" onClick={() => setMode("in")}>
                          Check it in instead
                        </button>
                      </>
                    ) : (
                      <>This item can&apos;t be checked out while it&apos;s {asset.status.replace("_", " ")}.</>
                    )}
                  </AlertDescription>
                </Alert>
              ) : seatsFull ? (
                <Alert>
                  <AlertDescription>All {asset.seats_total} seats are assigned. Release a seat in Check in mode first.</AlertDescription>
                </Alert>
              ) : (
                <CheckOutForm
                  key={asset.id}
                  assetId={asset.id}
                  assetName={asset.name}
                  kind={asset.kind}
                  condition={asset.condition}
                  defaultLoanDays={defaultLoanDays}
                  onDone={() => finished(physical ? `${asset.name} (${asset.asset_tag}) checked out.` : `Seat of ${asset.name} assigned.`)}
                />
              )
            ) : result && result.openCheckouts.length === 0 ? (
              <Alert>
                <AlertDescription>
                  This item isn&apos;t checked out, so there&apos;s nothing to check in.{" "}
                  <button type="button" className="font-medium text-primary underline underline-offset-4" onClick={() => setMode("out")}>
                    Check it out instead
                  </button>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {result && result.openCheckouts.length > 1 ? (
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">Whose seat are you releasing?</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {result.openCheckouts.map((c) => (
                        <label
                          key={c.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50",
                            checkinId === c.id && "border-primary bg-accent"
                          )}
                        >
                          <input type="radio" name="checkin-loan" value={c.id} checked={checkinId === c.id} onChange={() => setCheckinId(c.id)} className="accent-primary" />
                          <span>
                            <span className="block font-medium">{c.borrower}</span>
                            <span className="text-xs text-muted-foreground">since {formatDate(c.checked_out_at)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : selectedLoan ? (
                  <p className="text-sm">
                    Checked out to <strong>{selectedLoan.borrower}</strong> on {formatDate(selectedLoan.checked_out_at)}
                    {selectedLoan.due_at ? `, due ${formatDate(selectedLoan.due_at)}` : ""}.
                  </p>
                ) : null}
                {selectedLoan ? (
                  <CheckInForm
                    key={selectedLoan.id}
                    checkoutId={selectedLoan.id}
                    assetName={asset.name}
                    kind={asset.kind}
                    borrower={selectedLoan.borrower}
                    defaultCondition={asset.condition}
                    onDone={() =>
                      finished(physical ? `${asset.name} (${asset.asset_tag}) checked in.` : `Seat released from ${selectedLoan.borrower}.`)
                    }
                  />
                ) : null}
              </div>
            )}
          </div>
        ) : !lastDone && !message && suggestions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <ScanLine className="size-8" aria-hidden="true" />
            <p>Scan a QR label, use a USB barcode scanner, or type a tag and press Enter.</p>
          </div>
        ) : null}
      </CardContent>

      <ScannerDialog open={scanning} onOpenChange={setScanning} onScan={(text) => lookup(text)} />
    </Card>
  )
}
