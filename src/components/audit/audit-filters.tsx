"use client"

import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { withQuery } from "@/lib/url"

type Values = { action?: string; q?: string; from?: string; to?: string }

export function AuditFilters({ values, actions }: { values: Values; actions: string[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<Values>(values)

  return (
    <form
      role="search"
      className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(() => router.replace(withQuery("/audit", { ...state }), { scroll: false }))
      }}
    >
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor="audit-q">Search</Label>
        <Input id="audit-q" value={state.q ?? ""} onChange={(e) => setState({ ...state, q: e.target.value })} placeholder="Tag, item name, person…" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-action">Action</Label>
        <Select value={state.action ?? "all"} onValueChange={(v) => setState({ ...state, action: v === "all" ? undefined : v })}>
          <SelectTrigger id="audit-action" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-from">From</Label>
        <Input id="audit-from" type="date" value={state.from ?? ""} onChange={(e) => setState({ ...state, from: e.target.value || undefined })} className="w-40" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-to">To</Label>
        <Input id="audit-to" type="date" value={state.to ?? ""} onChange={(e) => setState({ ...state, to: e.target.value || undefined })} className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : <Search aria-hidden="true" />} Filter
      </Button>
    </form>
  )
}
