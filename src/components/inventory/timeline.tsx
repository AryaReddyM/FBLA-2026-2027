import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  FilePlus2,
  FileText,
  type LucideIcon,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react"

import { formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

export type TimelineItem = {
  id: string
  action: string
  summary: string
  at: string
  actor: string | null
}

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  create: { icon: FilePlus2, tone: "bg-success-soft text-success" },
  import: { icon: Upload, tone: "bg-success-soft text-success" },
  update: { icon: Pencil, tone: "bg-info-soft text-info" },
  retire: { icon: Archive, tone: "bg-neutral-soft text-neutral" },
  delete: { icon: Trash2, tone: "bg-danger-soft text-danger" },
  check_out: { icon: ArrowUpRight, tone: "bg-info-soft text-info" },
  check_in: { icon: ArrowDownLeft, tone: "bg-success-soft text-success" },
  report_generated: { icon: FileText, tone: "bg-neutral-soft text-neutral" },
}

/** Plain-language history: "Ms. Lee checked out Chromebook … to Student #10234". */
export function Timeline({ items, emptyText = "No activity yet." }: { items: TimelineItem[]; emptyText?: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>
  return (
    <ol className="relative space-y-4">
      {items.map((item, index) => {
        const { icon: Icon, tone } = ICONS[item.action] ?? ICONS.update
        return (
          <li key={item.id} className="relative flex gap-3">
            {index < items.length - 1 ? (
              <span aria-hidden="true" className="absolute top-8 bottom-[-1rem] left-[0.9375rem] w-px bg-border" />
            ) : null}
            <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full", tone)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm">
                <span className="font-medium">{item.actor ?? "System"}</span> {item.summary}
              </p>
              <p className="text-xs text-muted-foreground">
                <time dateTime={item.at} title={formatDateTime(item.at)}>
                  {formatDateTime(item.at)} · {formatRelative(item.at)}
                </time>
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
