"use client"

import { Printer } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Print button plus "start at label N", for reusing a partly used sheet. */
export function LabelSheetControls({ skip }: { skip: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="label-start">Start at label</Label>
        <Select
          value={String(skip + 1)}
          onValueChange={(v) => {
            const next = new URLSearchParams(searchParams.toString())
            next.set("skip", String(Number(v) - 1))
            router.replace(`${pathname}?${next.toString()}`, { scroll: false })
          }}
        >
          <SelectTrigger id="label-start" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 30 }, (_, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                Label {i + 1} (row {Math.floor(i / 3) + 1})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={() => window.print()}>
        <Printer aria-hidden="true" /> Print labels
      </Button>
    </div>
  )
}
