import {
  AlertTriangle,
  Archive,
  CircleCheck,
  CircleHelp,
  Clock,
  Hand,
  Laptop,
  type LucideIcon,
  Wrench,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { CONDITION_LABELS, KIND_LABELS, STATUS_LABELS } from "@/lib/labels"
import type { Enums } from "@/types/database"

// Status is never shown by color alone (WCAG 1.4.1): every badge has an icon
// and a word, so it works for colorblind users and in high-contrast mode.

const STATUS_STYLES: Record<Enums<"asset_status">, { icon: LucideIcon; className: string }> = {
  available: { icon: CircleCheck, className: "bg-success-soft text-success border-success/25" },
  checked_out: { icon: Hand, className: "bg-info-soft text-info border-info/25" },
  in_repair: { icon: Wrench, className: "bg-warning-soft text-warning border-warning/30" },
  retired: { icon: Archive, className: "bg-neutral-soft text-neutral border-neutral/25" },
  lost: { icon: CircleHelp, className: "bg-danger-soft text-danger border-danger/25" },
}

const base =
  "inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5"

export function StatusBadge({ status, className }: { status: Enums<"asset_status">; className?: string }) {
  const { icon: Icon, className: tone } = STATUS_STYLES[status]
  return (
    <span className={cn(base, tone, className)}>
      <Icon aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}

export function OverdueBadge({ className, label = "Overdue" }: { className?: string; label?: string }) {
  return (
    <span className={cn(base, "border-danger/25 bg-danger-soft text-danger", className)}>
      <AlertTriangle aria-hidden="true" />
      {label}
    </span>
  )
}

export function DueSoonBadge({ className, label }: { className?: string; label: string }) {
  return (
    <span className={cn(base, "border-warning/30 bg-warning-soft text-warning", className)}>
      <Clock aria-hidden="true" />
      {label}
    </span>
  )
}

const CONDITION_DOTS: Record<Enums<"asset_condition">, number> = { new: 5, good: 4, fair: 3, poor: 2, broken: 1 }

/** Condition as text plus a 5-step meter (the text carries the meaning; the meter is decoration). */
export function ConditionLabel({ condition }: { condition: Enums<"asset_condition"> | null }) {
  if (!condition) return <span className="text-muted-foreground">—</span>
  const filled = CONDITION_DOTS[condition]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-1 rounded-full",
              i <= filled ? (filled <= 2 ? "bg-danger" : filled === 3 ? "bg-warning" : "bg-success") : "bg-border",
            )}
          />
        ))}
      </span>
      {CONDITION_LABELS[condition]}
    </span>
  )
}

export function KindBadge({ kind }: { kind: Enums<"asset_kind"> }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      {kind === "digital" ? (
        <span
          aria-hidden="true"
          className="inline-flex size-5 items-center justify-center rounded bg-chart-5/15 text-[0.65rem] font-semibold text-foreground"
        >
          D
        </span>
      ) : (
        <Laptop aria-hidden="true" className="size-4 text-muted-foreground" />
      )}
      {KIND_LABELS[kind]}
    </span>
  )
}
