import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** "142 / 200 seats" with a bar. The text carries the meaning; the bar is a visual aid. */
export function SeatMeter({ used, total, className }: { used: number; total: number | null; className?: string }) {
  if (total === null) {
    return (
      <span className={cn("text-sm", className)}>
        {formatNumber(used)} assigned · <span className="text-muted-foreground">unlimited</span>
      </span>
    )
  }
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const tone = pct >= 100 ? "bg-danger" : pct >= 90 ? "bg-warning" : "bg-primary"
  return (
    <div className={cn("min-w-32 space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="font-medium tabular-nums">{formatNumber(used)}</span>
          <span className="text-muted-foreground"> / {formatNumber(total)} seats</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Seats in use"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={used}
        aria-valuetext={`${used} of ${total} seats in use`}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
