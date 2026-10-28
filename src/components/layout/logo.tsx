import { cn } from "@/lib/utils"
import { APP_NAME } from "@/lib/config"

/** onDark = lime mark for the dark green bands; otherwise forest green. */
export function LogoMark({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)} fill="none">
      <rect width="32" height="32" rx="9" className={onDark ? "fill-lime" : "fill-primary"} />
      {/* A box with a check: "everything accounted for" */}
      <path
        d="M9 12.5 16 9l7 3.5v8L16 24l-7-3.5v-8Z"
        className={onDark ? "stroke-lime-foreground" : "stroke-primary-foreground"}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="m9 12.5 7 3.5 7-3.5M16 16v8"
        className={onDark ? "stroke-lime-foreground" : "stroke-primary-foreground"}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ className, subtitle, onDark }: { className?: string; subtitle?: string; onDark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark onDark={onDark} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-base font-bold tracking-tight">{APP_NAME}</span>
        {subtitle ? (
          <span className={cn("truncate text-xs", onDark ? "text-brand-muted" : "text-muted-foreground")}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  )
}
