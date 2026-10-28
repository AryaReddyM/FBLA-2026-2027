import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** The dark band reaches the screen edges even though the page content is centered. */
const BAND =
  "relative isolate text-brand-foreground before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:bg-brand"

/**
 * Buttons inside a band switch to the band's palette: the main action turns
 * lime (like the mockup's "Search catalog"), outline buttons turn light.
 * Matched on data-variant alone: a button used as a menu trigger has its
 * data-slot replaced by the trigger's.
 */
const BAND_BUTTONS = [
  "[&_[data-variant=default]]:bg-lime",
  "[&_[data-variant=default]]:text-lime-foreground",
  "[&_[data-variant=default]:hover]:bg-lime/85",
  "[&_[data-variant=outline]]:border-white/30",
  "[&_[data-variant=outline]]:bg-white/5",
  "[&_[data-variant=outline]]:text-white",
  "[&_[data-variant=outline]:hover]:bg-white/15",
].join(" ")

/**
 * The top of every page: a deep green hero band with a lime eyebrow line, a
 * large title, and optional actions or a search bar. `overlap` leaves room
 * for a StatStrip card to sit across the band's bottom edge.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  size = "default",
  overlap = false,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  size?: "default" | "lg"
  overlap?: boolean
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      data-band
      className={cn(
        BAND,
        BAND_BUTTONS,
        size === "lg" ? "pt-10 sm:pt-14" : "pt-8 sm:pt-10",
        overlap ? "pb-28 sm:pb-32" : "pb-8 sm:pb-10",
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          {eyebrow ? (
            <div className="text-xs font-bold tracking-[0.18em] text-lime uppercase [&_a]:underline-offset-4 [&_a:hover]:underline">
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={cn(
              "font-semibold tracking-tight text-white",
              size === "lg"
                ? "max-w-3xl text-4xl sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]"
                : "text-3xl sm:text-4xl",
            )}
          >
            {title}
          </h1>
          {description ? <div className="max-w-2xl text-base text-brand-muted sm:text-lg">{description}</div> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2" data-print-hide>
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-7">{children}</div> : null}
    </section>
  )
}

/** Placeholder band while a page's data loads, so the layout doesn't jump. */
export function PageHeaderSkeleton({
  overlap = false,
  size = "default",
}: {
  overlap?: boolean
  size?: "default" | "lg"
}) {
  return (
    <section
      data-band
      aria-hidden="true"
      className={cn(
        BAND,
        size === "lg" ? "pt-10 sm:pt-14" : "pt-8 sm:pt-10",
        overlap ? "pb-28 sm:pb-32" : "pb-8 sm:pb-10",
      )}
    >
      <div className="space-y-4">
        <div className="h-3 w-48 animate-pulse rounded-full bg-white/15" />
        <div
          className={cn("animate-pulse rounded-xl bg-white/15", size === "lg" ? "h-12 w-full max-w-xl" : "h-9 w-72")}
        />
        <div className="h-4 w-full max-w-md animate-pulse rounded-full bg-white/10" />
      </div>
    </section>
  )
}

/** Standard page width and spacing used by every app page. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8", className)}>{children}</div>
  )
}

export type Stat = {
  label: string
  value: string
  hint?: string
  href?: string
  tone?: "danger" | "warning"
}

/**
 * The white numbers card that overlaps the bottom of a hero band (mockup:
 * CATALOG UNITS / AVAILABLE NOW / DIGITAL ACCESS / CATALOG VALUE).
 */
export function StatStrip({
  stats,
  label = "Key numbers",
  className,
}: {
  stats: Stat[]
  label?: string
  className?: string
}) {
  const cols = stats.length >= 5 ? "lg:grid-cols-5" : stats.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
  return (
    <section
      aria-label={label}
      className={cn(
        "relative z-10 -mt-24 overflow-hidden rounded-2xl bg-card shadow-lg ring-1 shadow-black/5 ring-foreground/8 sm:-mt-28",
        className,
      )}
    >
      <ul className={cn("grid grid-cols-2", cols)}>
        {stats.map((stat) => {
          const body = (
            <>
              <span className="block text-[0.7rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                {stat.label}
              </span>
              <span
                className={cn(
                  "mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight tabular-nums",
                  stat.tone === "danger" && "text-danger",
                  stat.tone === "warning" && "text-warning",
                )}
              >
                {stat.tone ? <AlertTriangle className="size-5" aria-hidden="true" /> : null}
                {stat.value}
              </span>
              {stat.hint ? <span className="mt-1 block text-xs text-muted-foreground">{stat.hint}</span> : null}
            </>
          )
          return (
            <li key={stat.label} className="min-w-0">
              {stat.href ? (
                <Link href={stat.href} className="block h-full p-5 transition-colors hover:bg-muted/60 sm:p-6">
                  {body}
                </Link>
              ) : (
                <div className="h-full p-5 sm:p-6">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
