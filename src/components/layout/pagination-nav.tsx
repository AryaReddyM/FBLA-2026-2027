import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { withQuery, type QueryValue } from "@/lib/url"

/** Server-rendered pagination: plain links, so it works with or without JavaScript. */
export function PaginationNav({
  path,
  params,
  page,
  pageSize,
  total,
}: {
  path: string
  params: Record<string, QueryValue>
  page: number
  pageSize: number
  total: number
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const near = [page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= pages)
  const href = (p: number) => withQuery(path, { ...params, page: p === 1 ? undefined : p })

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{formatNumber(from)}</span>–
        <span className="font-medium text-foreground">{formatNumber(to)}</span> of{" "}
        <span className="font-medium text-foreground">{formatNumber(total)}</span>
      </p>
      {pages > 1 ? (
        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={href(page - 1)} scroll={false} rel="prev">
                  <ChevronLeft aria-hidden="true" /> Previous
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft aria-hidden="true" /> Previous
              </Button>
            )}
          </li>
          {near.map((p) => (
            <li key={p} className="hidden sm:block">
              <Button variant={p === page ? "default" : "ghost"} size="sm" className="min-w-8" asChild>
                <Link
                  href={href(p)}
                  scroll={false}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}`}
                >
                  {p}
                </Link>
              </Button>
            </li>
          ))}
          <li>
            {page < pages ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={href(page + 1)} scroll={false} rel="next">
                  Next <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </li>
        </ul>
      ) : null}
    </nav>
  )
}
